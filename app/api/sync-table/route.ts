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
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { dataset, folderName, tableName, spreadsheetId, sheetName, schema, startRow = 1, hasHeader = true } = await request.json();
    
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

    // บันทึก sync config พร้อม startRow และ hasHeader
    if (dbType === 'mysql') {
      await pool.query(
        `INSERT INTO sync_config (table_name, spreadsheet_id, sheet_name, folder_name, dataset_name, start_row, has_header) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE spreadsheet_id = VALUES(spreadsheet_id), sheet_name = VALUES(sheet_name), start_row = VALUES(start_row), has_header = VALUES(has_header)`,
        [tableName, spreadsheetId, sheetName, folderName || '', dataset, startRow, hasHeader ? 1 : 0]
      );
    } else {
      await pool.query(
        `INSERT INTO sync_config (table_name, spreadsheet_id, sheet_name, folder_name, dataset_name, start_row, has_header) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (table_name) 
         DO UPDATE SET spreadsheet_id = $2, sheet_name = $3, start_row = $6, has_header = $7`,
        [tableName, spreadsheetId, sheetName, folderName || '', dataset, startRow, hasHeader]
      );
    }

    // บันทึกใน folder_tables ถ้ามี folderName (ใช้ MongoDB)
    if (folderName) {
      try {
        // หา folder document จากชื่อ
        const folder = await mongoDb.collection('folders').findOne({ name: folderName });
        
        if (folder) {
          // บันทึกลง MongoDB folder_tables (ใช้ ObjectId แทน string)
          await mongoDb.collection('folder_tables').updateOne(
            { folder_id: folder._id, table_name: tableName },
            { 
              $set: { 
                folder_id: folder._id, 
                table_name: tableName,
                updated_at: new Date()
              },
              $setOnInsert: { created_at: new Date() }
            },
            { upsert: true }
          );
        }
      } catch (mongoError) {
        console.error('Error saving to MongoDB folder_tables:', mongoError);
        // ไม่ throw error เพื่อให้การสร้างตารางดำเนินต่อไป
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
    const { dataset, tableName, forceSync = false } = await request.json();
    
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

    // ใช้ค่า start_row และ has_header จาก config (default: 1, true)
    const configStartRow = config.start_row || 1;
    const configHasHeader = config.has_header !== undefined ? config.has_header : true;
    const dataStartRow = configHasHeader ? configStartRow + 1 : configStartRow;

    // 🚀 OPTIMIZATION: ตรวจสอบ checksum ก่อนเพื่อลด API calls
    if (!forceSync) {
      try {
        console.log(`[Checksum] Checking if ${tableName} needs sync...`);
        
        // ดึง header range (ถ้ามี) หรือแถวแรกเพื่อเช็ค checksum
        const headerRange = configHasHeader 
          ? `${config.sheet_name}!A${configStartRow}:ZZ${configStartRow}`
          : `${config.sheet_name}!A${dataStartRow}:ZZ${dataStartRow}`;
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheet_id,
          range: headerRange,
        });
        
        // นับจำนวนแถวทั้งหมดโดยดึงคอลัมน์แรกทั้งหมด
        const allRowsRange = `${config.sheet_name}!A:A`;
        const countResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheet_id,
          range: allRowsRange,
        });
        
        const totalSheetRows = (countResponse.data.values || []).length;
        const currentRowCount = configHasHeader 
          ? Math.max(0, totalSheetRows - configStartRow) // ลบ rows ก่อน startRow และ header
          : Math.max(0, totalSheetRows - configStartRow + 1); // ลบ rows ก่อน startRow
        const lastChecksum = config.last_checksum;
        const lastRowCount = config.last_row_count || 0;
        
        // ถ้าจำนวนแถวเท่าเดิม ให้สุ่มตรวจสอบ sample rows
        if (currentRowCount === lastRowCount && lastChecksum && currentRowCount > 0) {
          console.log(`[Checksum] Row count unchanged (${currentRowCount}), checking sample data...`);
          
          // ดึง sample: แถวแรก, กลาง, สุดท้าย (ใช้ dataStartRow)
          const firstRowNum = dataStartRow;
          const middleRowNum = Math.max(dataStartRow, Math.floor((dataStartRow + currentRowCount - 1) / 2));
          const lastRowNum = dataStartRow + currentRowCount - 1;
          
          // ใช้ array แยก ranges แทนการใช้ comma-separated string
          const sampleRanges = [
            `${config.sheet_name}!A${firstRowNum}:ZZ${firstRowNum}`,
            `${config.sheet_name}!A${middleRowNum}:ZZ${middleRowNum}`,
            `${config.sheet_name}!A${lastRowNum}:ZZ${lastRowNum}`
          ];
          
          const sampleResponse = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: config.spreadsheet_id,
            ranges: sampleRanges,
          });
          
          const sampleRows = sampleResponse.data.valueRanges?.flatMap(vr => vr.values || []) || [];
          const newChecksum = calculateChecksum([headerResponse.data.values?.[0] || [], ...sampleRows]);
          
          if (newChecksum === lastChecksum) {
            console.log(`[Checksum] ✓ No changes detected, skipping sync for ${tableName}`);
            
            // อัพเดท log - skipped
            if (logId) {
              await pool.query(
                `UPDATE sync_logs 
                 SET status = $1, 
                     completed_at = NOW(), 
                     sync_duration = 0,
                     rows_synced = $2
                 WHERE id = $3`,
                ['skipped', currentRowCount, logId]
              );
            }
            
            return NextResponse.json({ 
              success: true, 
              skipped: true,
              message: `No changes detected, sync skipped`,
              stats: {
                inserted: 0,
                updated: 0,
                deleted: 0,
                total: currentRowCount
              }
            });
          } else {
            console.log(`[Checksum] Changes detected (checksum mismatch), proceeding with sync...`);
          }
        } else {
          console.log(`[Checksum] Row count changed (${lastRowCount} → ${currentRowCount}), proceeding with sync...`);
        }
      } catch (checksumError: any) {
        console.error(`[Checksum] Error checking checksum for ${tableName}, proceeding with full sync:`, checksumError.message);
        // ถ้า checksum error ให้ sync เต็มรูปแบบต่อ
      }
    }

    // ดึงข้อมูลจาก Google Sheets แบบไม่จำกัดจำนวนแถว
    let allRows: any[] = [];
    let fetchStartRow = configStartRow; // เริ่มจาก startRow ที่กำหนดไว้
    const batchSize = 50000; // ดึงทีละ 50,000 แถว
    let hasMore = true;

    console.log(`Starting full sync for ${tableName} from row ${fetchStartRow}...`);

    while (hasMore) {
      const endRow = fetchStartRow + batchSize - 1;
      const range = `${config.sheet_name}!A${fetchStartRow}:ZZ${endRow}`;
      
      console.log(`Fetching rows ${fetchStartRow} to ${endRow}...`);
      
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
          fetchStartRow += batchSize;
        }
      }

      console.log(`Total rows fetched so far: ${allRows.length}`);
    }

    console.log(`Completed fetching. Total rows: ${allRows.length}`);

    const rows = allRows;
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data to sync' }, { status: 404 });
    }

    console.log(`Proceeding with sync for ${tableName}...`);

    // ตรวจสอบว่ามี header หรือไม่
    let headers: string[];
    let dataRows: any[];
    
    if (configHasHeader) {
      headers = rows[0]; // แถวแรกคือ header
      dataRows = rows.slice(1); // แถวที่เหลือคือ data
    } else {
      // ไม่มี header - ใช้ชื่อคอลัมน์จาก schema
      const schemaResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = $1 AND column_name NOT IN ('id', 'synced_at') 
         ORDER BY ordinal_position`,
        [tableName]
      );
      headers = schemaResult.rows.map((r: any) => r.column_name);
      dataRows = rows; // ทุกแถวคือ data
    }

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'No data rows to sync' }, { status: 404 });
    }

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

    // คำนวณ checksum ใหม่สำหรับครั้งถัดไป
    const newChecksum = calculateChecksum([
      headers,
      dataRows[0] || [],
      dataRows[Math.floor(dataRows.length / 2)] || [],
      dataRows[dataRows.length - 1] || []
    ]);

    // อัพเดท last_sync พร้อม checksum และ row count
    await pool.query(
      `UPDATE sync_config 
       SET last_sync = NOW(), 
           last_checksum = $1, 
           last_row_count = $2 
       WHERE table_name = $3`,
      [newChecksum, dataRows.length, tableName]
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
