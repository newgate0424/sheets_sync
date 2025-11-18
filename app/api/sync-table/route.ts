import { NextRequest, NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import { getMongoDb } from '@/lib/mongoDb';
import crypto from 'crypto';

// ฟังก์ชันคำนวณ checksum จาก Google Sheets data
function calculateChecksum(rows: any[][]): string {
  if (rows.length === 0) return '';
  
  const dataToHash = JSON.stringify({
    rowCount: rows.length,
    firstRow: rows[0],
    lastRow: rows[rows.length - 1],
    // เพิ่ม sample จาก row กลางๆ เพื่อความแม่นยำ
    middleRow: rows[Math.floor(rows.length / 2)]
  });
  
  return crypto.createHash('md5').update(dataToHash).digest('hex');
}

// POST - สร้างตารางและ sync ข้อมูล
export async function POST(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { dataset, folderName, tableName, spreadsheetId, sheetName, schema } = await request.json();
    
    if (!dataset || !tableName || !spreadsheetId || !sheetName || !schema) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // สร้างตารางตาม schema
    const columns = schema.map((col: any) => 
      `"${col.name}" ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}`
    ).join(', ');
    
    const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      ${columns},
      synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    await pool.query(createTableSQL);

    // อ่าน dbType
    const mongoDb = await getMongoDb();
    const settings = await mongoDb.collection('settings').findOne({ key: 'database_connection' });
    const dbType = settings?.dbType || 'mysql';

    // บันทึก sync config (ใช้เฉพาะ table_name, spreadsheet_id, sheet_name)
    if (dbType === 'mysql') {
      await pool.query(
        `INSERT INTO sync_config (table_name, spreadsheet_id, sheet_name, folder_name, dataset_name) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE spreadsheet_id = VALUES(spreadsheet_id), sheet_name = VALUES(sheet_name)`,
        [tableName, spreadsheetId, sheetName, folderName || '', dataset]
      );
    } else {
      await pool.query(
        `INSERT INTO sync_config (table_name, spreadsheet_id, sheet_name, folder_name, dataset_name) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (table_name) 
         DO UPDATE SET spreadsheet_id = $2, sheet_name = $3`,
        [tableName, spreadsheetId, sheetName, folderName || '', dataset]
      );
    }

    // บันทึกใน folder_tables ถ้ามี folderName (ใช้ folder_id แทน folder_name)
    if (folderName) {
      // หา folder_id จาก folder name
      const folderResult = await pool.query(
        dbType === 'mysql' 
          ? 'SELECT id FROM `folders` WHERE name = ?' 
          : 'SELECT id FROM "folders" WHERE name = $1',
        [folderName]
      );
      
      if (folderResult.rows.length > 0) {
        const folderId = folderResult.rows[0].id;
        
        if (dbType === 'mysql') {
          await pool.query(
            `INSERT INTO folder_tables (folder_id, table_name) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE table_name = VALUES(table_name)`,
            [folderId, tableName]
          );
        } else {
          await pool.query(
            `INSERT INTO folder_tables (folder_id, table_name) 
             VALUES ($1, $2) 
             ON CONFLICT (folder_id, table_name) DO NOTHING`,
            [folderId, tableName]
          );
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Table created successfully' });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Sync ข้อมูลจาก Google Sheets
export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  let logId: number | null = null;
  
  try {
    const pool = await ensureDbInitialized();
    const { dataset, tableName } = await request.json();
    
    if (!dataset || !tableName) {
      return NextResponse.json({ error: 'Dataset and table name are required' }, { status: 400 });
    }

    // สร้าง log entry
    const logResult = await pool.query(
      'INSERT INTO sync_logs (status, table_name) VALUES ($1, $2) RETURNING id',
      ['running', tableName]
    );
    logId = logResult.rows[0].id;

    // ดึง sync config
    const configs = await pool.query(
      'SELECT * FROM sync_config WHERE table_name = $1',
      [tableName]
    );

    if (configs.rows.length === 0) {
      return NextResponse.json({ error: 'Sync config not found' }, { status: 404 });
    }

    const config = configs.rows[0];
    const sheets = await getGoogleSheetsClient();

    // ดึงข้อมูลจาก Google Sheets แบบไม่จำกัดจำนวนแถว
    let allRows: any[] = [];
    let startRow = 1;
    const batchSize = 50000; // ดึงทีละ 50,000 แถว
    let hasMore = true;

    console.log(`Starting sync for ${tableName}...`);

    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const range = `${config.sheet_name}!A${startRow}:ZZ${endRow}`;
      
      console.log(`Fetching rows ${startRow} to ${endRow}...`);
      
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

      console.log(`Total rows fetched so far: ${allRows.length}`);
    }

    console.log(`Completed fetching. Total rows: ${allRows.length}`);

    const rows = allRows;
    
    if (rows.length <= 1) {
      return NextResponse.json({ error: 'No data to sync' }, { status: 404 });
    }

    console.log(`Proceeding with sync for ${tableName}...`);

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // เตรียมชื่อคอลัมน์
    const columnNames = headers.map((h: string) => 
      `"${h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}"`
    ).join(', ');

    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // นับจำนวนแถวเดิมก่อนลบ
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const oldRowCount = parseInt(countResult.rows[0]?.count || '0');

    console.log(`Deleted ${oldRowCount} old rows, preparing to insert ${dataRows.length} new rows...`);

    // เริ่ม transaction เพื่อความเร็ว
    await pool.query('START TRANSACTION');

    try {
      // ลบข้อมูลเก่าทั้งหมด (TRUNCATE เร็วกว่า DELETE)
      await pool.query(`TRUNCATE TABLE "${tableName}"`);
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
          
          // สร้าง parameterized query
          const valueRows = batch.map((row, rowIndex) => {
            const placeholders = headers.map((_: any, colIndex: number) => {
              const paramIndex = rowIndex * headers.length + colIndex + 1;
              return `$${paramIndex}`;
            }).join(', ');
            return `(${placeholders})`;
          }).join(', ');

          // สร้าง array ของค่าทั้งหมด
          const allValues = batch.flatMap(row => 
            headers.map((_: any, index: number) => {
              const val = row[index];
              return val !== undefined && val !== '' ? val : null;
            })
          );

          await pool.query(
            `INSERT INTO "${tableName}" (${columnNames}) VALUES ${valueRows}`,
            allValues
          );
          
          insertedCount += batch.length;
          
          // Log ทุก 50,000 แถว เพื่อลด overhead
          if (insertedCount % 50000 === 0 || insertedCount === dataRows.length) {
            console.log(`Inserted ${insertedCount}/${dataRows.length} rows...`);
          }
        }
      }

      // Commit transaction
      await pool.query('COMMIT');

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

    console.log(`Sync completed: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`);

    // อัพเดท last_sync
    await pool.query(
      'UPDATE sync_config SET last_sync = NOW() WHERE table_name = $1',
      [tableName]
    );

    // อัพเดท log - success
    const duration = Math.floor((Date.now() - startTime) / 1000);
    if (logId) {
      await pool.query(
        `UPDATE sync_logs 
         SET status = $1, 
             completed_at = NOW(), 
             sync_duration = $2,
             rows_inserted = $3,
             rows_updated = $4,
             rows_deleted = $5,
             rows_synced = $6
         WHERE id = $7`,
        ['success', duration, insertedCount, updatedCount, deletedCount, dataRows.length, logId]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sync completed: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted`,
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        total: dataRows.length
      }
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    
    // อัพเดท log - error
    if (logId) {
      try {
        const pool = await ensureDbInitialized();
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await pool.query(
          `UPDATE sync_logs 
           SET status = $1, 
               completed_at = NOW(), 
               sync_duration = $2,
               error_message = $3
           WHERE id = $4`,
          ['error', duration, error.message, logId]
        );
      } catch (logError) {
        console.error('Error updating log:', logError);
      }
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
