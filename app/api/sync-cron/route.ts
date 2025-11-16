import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ฟังก์ชันคำนวณ checksum จาก Google Sheets data
function calculateChecksum(rows: any[][]): string {
  if (rows.length === 0) return '';
  
  const dataToHash = JSON.stringify({
    rowCount: rows.length,
    firstRow: rows[0],
    lastRow: rows[rows.length - 1],
    middleRow: rows[Math.floor(rows.length / 2)]
  });
  
  return crypto.createHash('md5').update(dataToHash).digest('hex');
}

// GET - API สำหรับ Cron Job เรียกใช้ sync อัตโนมัติ
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let logId: number | null = null;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const dataset = searchParams.get('dataset');
    const tableName = searchParams.get('table');

    // ตรวจสอบ token (ใช้ environment variable)
    const validToken = process.env.CRON_SYNC_TOKEN || 'default-secret-token';
    
    if (token !== validToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!dataset || !tableName) {
      return NextResponse.json({ error: 'Dataset and table name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();

    // สร้าง log entry
    const [logResult]: any = await connection.query(
      'INSERT INTO sync_logs (status, table_name, dataset_name) VALUES (?, ?, ?)',
      ['running', tableName, dataset]
    );
    logId = logResult.insertId;

    // ดึง sync config
    const [configs]: any = await connection.query(
      'SELECT * FROM sync_config WHERE dataset_name = ? AND table_name = ?',
      [dataset, tableName]
    );

    if (configs.length === 0) {
      connection.release();
      return NextResponse.json({ error: 'Sync config not found' }, { status: 404 });
    }

    const config = configs[0];
    const sheets = await getGoogleSheetsClient();

    // ดึงข้อมูลจาก Google Sheets แบบไม่จำกัดจำนวนแถว
    let allRows: any[] = [];
    let startRow = 1;
    const batchSize = 50000; // ดึงทีละ 50,000 แถว
    let hasMore = true;

    console.log(`[Cron] Starting sync for ${tableName}...`);

    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const range = `${config.sheet_name}!A${startRow}:ZZ${endRow}`;
      
      console.log(`[Cron] Fetching rows ${startRow} to ${endRow}...`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheet_id,
        range: range,
      });

      const batchRows = response.data.values || [];
      
      if (batchRows.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...batchRows);
        
        // ถ้าได้น้อยกว่า batch size แสดงว่าหมดแล้ว
        if (batchRows.length < batchSize) {
          hasMore = false;
        } else {
          startRow += batchSize;
        }
      }

      console.log(`[Cron] Total rows fetched so far: ${allRows.length}`);
    }

    console.log(`[Cron] Completed fetching. Total rows: ${allRows.length}`);

    const rows = allRows;
    
    if (rows.length <= 1) {
      connection.release();
      return NextResponse.json({ error: 'No data to sync' }, { status: 404 });
    }

    // คำนวณ checksum ของข้อมูลใหม่
    const newChecksum = calculateChecksum(rows);
    const oldChecksum = config.last_checksum;

    console.log(`[Cron] Checksum - Old: ${oldChecksum}, New: ${newChecksum}`);

    // ถ้า checksum เหมือนเดิม = ข้อมูลไม่เปลี่ยน → ข้าม sync
    if (oldChecksum && oldChecksum === newChecksum) {
      console.log(`[Cron] Data unchanged, skipping sync for ${tableName}`);
      
      // อัปเดต skip_count
      await connection.query(
        'UPDATE sync_config SET skip_count = skip_count + 1 WHERE dataset_name = ? AND table_name = ?',
        [dataset, tableName]
      );

      // อัปเดท log - skipped
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (logId) {
        await connection.query(
          `UPDATE sync_logs 
           SET status = 'skipped', 
               completed_at = NOW(), 
               duration_seconds = ?,
               inserted = 0,
               updated = 0,
               deleted = 0
           WHERE id = ?`,
          [duration, logId]
        );
      }

      connection.release();

      return NextResponse.json({ 
        success: true, 
        skipped: true,
        message: `[Cron] Sync skipped - data unchanged (checksum: ${newChecksum})`,
        stats: {
          inserted: 0,
          updated: 0,
          deleted: 0,
          total: rows.length - 1
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[Cron] Data changed, proceeding with sync...`);

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // เตรียมชื่อคอลัมน์
    const columnNames = headers.map((h: string) => 
      `\`${h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}\``
    ).join(', ');

    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // นับจำนวนแถวเดิม
    const [countResult]: any = await connection.query(`SELECT COUNT(*) as count FROM \`${dataset}\`.\`${tableName}\``);
    const oldRowCount = countResult[0]?.count || 0;

    // ลบข้อมูลเก่าทั้งหมด
    await connection.query(`TRUNCATE TABLE \`${dataset}\`.\`${tableName}\``);
    deletedCount = oldRowCount;

    console.log(`[Cron] Deleted ${deletedCount} old rows, inserting ${dataRows.length} new rows...`);

    // Insert ข้อมูลใหม่แบบ batch
    if (dataRows.length > 0) {
      const batchSize = 1000;
      
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        const values = batch.map(row => {
          const vals = headers.map((_: any, index: number) => {
            const val = row[index];
            return val !== undefined && val !== '' ? connection.escape(val) : 'NULL';
          }).join(', ');
          return `(${vals})`;
        }).join(', ');

        await connection.query(
          `INSERT INTO \`${dataset}\`.\`${tableName}\` (${columnNames}) VALUES ${values}`
        );
        
        insertedCount += batch.length;
        console.log(`[Cron] Inserted ${insertedCount}/${dataRows.length} rows...`);
      }
    }

    // คำนวณสถิติ
    if (dataRows.length > oldRowCount) {
      updatedCount = oldRowCount;
      insertedCount = dataRows.length - oldRowCount;
    } else if (dataRows.length < oldRowCount) {
      updatedCount = dataRows.length;
      deletedCount = oldRowCount - dataRows.length;
      insertedCount = 0;
    } else {
      updatedCount = dataRows.length;
      insertedCount = 0;
      deletedCount = 0;
    }

    console.log(`[Cron] Sync completed: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`);

    // อัพเดท last_sync และ checksum
    await connection.query(
      'UPDATE sync_config SET last_sync = NOW(), last_checksum = ?, skip_count = 0 WHERE dataset_name = ? AND table_name = ?',
      [newChecksum, dataset, tableName]
    );

    // อัพเดท log - success
    const duration = Math.floor((Date.now() - startTime) / 1000);
    if (logId) {
      await connection.query(
        `UPDATE sync_logs 
         SET status = 'success', 
             completed_at = NOW(), 
             duration_seconds = ?,
             inserted = ?,
             updated = ?,
             deleted = ?
         WHERE id = ?`,
        [duration, insertedCount, updatedCount, deletedCount, logId]
      );
    }

    connection.release();

    return NextResponse.json({ 
      success: true, 
      message: `[Cron] Sync completed: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`,
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        total: dataRows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Cron sync error:', error);
    
    // อัพเดท log - error
    if (logId) {
      try {
        const connection = await pool.getConnection();
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await connection.query(
          `UPDATE sync_logs 
           SET status = 'error', 
               completed_at = NOW(), 
               duration_seconds = ?,
               error_message = ?
           WHERE id = ?`,
          [duration, error.message, logId]
        );
        connection.release();
      } catch (logError) {
        console.error('[Cron] Error updating log:', logError);
      }
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
