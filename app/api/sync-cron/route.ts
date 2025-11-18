import { NextRequest, NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';
import { getGoogleSheetsClient } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

// GET - API สำหรับ Cron Job เรียกใช้ sync อัตโนมัติ
export async function GET(request: NextRequest) {
  const pool = await ensureDbInitialized();
  const startTime = Date.now();
  let logId: number | null = null;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const tableName = searchParams.get('table');

    // ตรวจสอบ token (ใช้ environment variable)
    const validToken = process.env.CRON_SYNC_TOKEN || 'your-secret-token-here-change-this';
    
    if (token !== validToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    // ดึง sync config ก่อนเพื่อเอา folder_name
    const configResult = await pool.query(
      'SELECT * FROM sync_config WHERE table_name = ?',
      [tableName]
    );

    const configs = configResult.rows || configResult;

    if (!Array.isArray(configs) || configs.length === 0) {
      return NextResponse.json({ 
        error: 'Sync config not found for table: ' + tableName
      }, { status: 404 });
    }

    const config = configs[0];
    
    const folderName = config?.folder_name || 'default';
    const spreadsheetId = config?.spreadsheet_id;
    const sheetName = config?.sheet_name;

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json({ 
        error: 'Missing spreadsheet_id or sheet_name in config'
      }, { status: 400 });
    }

    // สร้าง log entry
    await pool.query(
      'INSERT INTO sync_logs (status, table_name, folder_name) VALUES (?, ?, ?)',
      ['running', tableName, folderName]
    );
    
    // ดึง insertId ด้วย LAST_INSERT_ID() เพราะ pool.query ไม่ return insertId
    const idResult: any = await pool.query('SELECT LAST_INSERT_ID() as id');
    logId = idResult[0]?.id || idResult.rows?.[0]?.id || null;
    console.log(`[Cron] Created log entry with ID: ${logId}`);

    const sheets = await getGoogleSheetsClient();

    // ดึงข้อมูลจาก Google Sheets แบบไม่จำกัดจำนวนแถว
    let allRows: any[] = [];
    let startRow = 1;
    const batchSize = 50000; // ดึงทีละ 50,000 แถว
    let hasMore = true;

    console.log(`[Cron] Starting sync for ${tableName}...`);

    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const range = `${sheetName}!A${startRow}:ZZ${endRow}`;
      
      console.log(`[Cron] Fetching rows ${startRow} to ${endRow}...`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
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
      return NextResponse.json({ error: 'No data to sync' }, { status: 404 });
    }

    console.log(`[Cron] Proceeding with sync for ${tableName}...`);

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // เตรียมชื่อคอลัมน์ สำหรับ MySQL
    const columnNames = headers.map((h: string) => 
      `\`${h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}\``
    ).join(', ');

    let actualInsertedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // นับจำนวนแถวเดิม
    const countResult: any = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    const oldRowCount = parseInt(countResult[0]?.count || 0);

    console.log(`[Cron] Preparing to sync ${dataRows.length} rows (old: ${oldRowCount})...`);

    // เริ่ม transaction เพื่อความเร็ว
    await pool.query('START TRANSACTION');

    try {
      // ลบข้อมูลเก่าทั้งหมด (TRUNCATE เร็วกว่า DELETE)
      await pool.query(`TRUNCATE TABLE \`${tableName}\``);
      deletedCount = oldRowCount;

      // Insert ข้อมูลใหม่แบบ batch ขนาดใหญ่
      if (dataRows.length > 0) {
        // คำนวณ batch size ตาม column count (MySQL limit 65,535 placeholders)
        const maxPlaceholders = 65000; // เผื่อ buffer
        const columnsCount = headers.length;
        const maxRowsPerBatch = Math.floor(maxPlaceholders / columnsCount);
        const batchSize = Math.min(maxRowsPerBatch, dataRows.length > 100000 ? 10000 : 5000);
        
        for (let i = 0; i < dataRows.length; i += batchSize) {
          const batch = dataRows.slice(i, i + batchSize);
          
          // สร้าง parameterized query สำหรับ MySQL
          const placeholders: string[] = [];
          const values: any[] = [];
          
          batch.forEach(row => {
            const rowPlaceholders = headers.map(() => '?').join(', ');
            placeholders.push(`(${rowPlaceholders})`);
            headers.forEach((_: any, index: number) => {
              const val = row[index];
              values.push(val !== undefined && val !== '' ? val : null);
            });
          });

          await pool.query(
            `INSERT INTO \`${tableName}\` (${columnNames}) VALUES ${placeholders.join(', ')}`,
            values
          );
          
          actualInsertedCount += batch.length;
          
          // Log ทุก 50,000 แถว เพื่อลด overhead
          if (actualInsertedCount % 50000 === 0 || actualInsertedCount === dataRows.length) {
            console.log(`[Cron] Inserted ${actualInsertedCount}/${dataRows.length} rows...`);
          }
        }
      }

      // Commit transaction
      await pool.query('COMMIT');
      
      console.log(`[Cron] Transaction committed successfully`);

    } catch (error) {
      // Rollback ถ้า error
      await pool.query('ROLLBACK');
      throw error;
    }

    // คำนวณ updated (ถ้าแถวเท่าเดิม = update, ถ้าแถวมากกว่า = insert)
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

    // อัพเดท last_sync
    await pool.query(
      'UPDATE sync_config SET last_sync = NOW() WHERE table_name = ?',
      [tableName]
    );

    // อัพเดท log - success
    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[Cron] About to update log ${logId} to success...`);
    if (logId) {
      try {
        console.log(`[Cron] Updating log ${logId} to success...`);
        const updateResult = await pool.query(
          `UPDATE sync_logs 
           SET status = ?, 
               completed_at = NOW(), 
               sync_duration = ?,
               rows_inserted = ?,
               rows_updated = ?,
               rows_deleted = ?,
               rows_synced = ?
           WHERE id = ?`,
          ['success', duration, insertedCount, updatedCount, deletedCount, dataRows.length, logId]
        );
        console.log(`[Cron] Log ${logId} update result:`, updateResult);
      } catch (updateError) {
        console.error(`[Cron] Failed to update log ${logId}:`, updateError);
      }
    } else {
      console.log('[Cron] No logId, skipping log update');
    }

    return NextResponse.json({ 
      success: true, 
      message: `[Cron] Sync completed successfully`,
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
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await pool.query(
          `UPDATE sync_logs 
           SET status = ?, 
               completed_at = NOW(), 
               sync_duration = ?,
               error_message = ?
           WHERE id = ?`,
          ['error', duration, error.message, logId]
        );
      } catch (logError) {
        console.error('[Cron] Error updating log:', logError);
      }
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
