// Shared sync service - เรียกได้ทั้งจาก API route และ cron โดยตรง
import { ensureDbInitialized } from './dbAdapter';
import { getGoogleSheetsClient } from './googleSheets';
import crypto from 'crypto';

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

export interface SyncParams {
  dataset: string;
  tableName: string;
  forceSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  stats?: {
    inserted: number;
    updated: number;
    deleted: number;
    total: number;
  };
}

/**
 * Core sync logic - ใช้ได้โดยตรงไม่ต้องผ่าน HTTP
 */
export async function performSync(params: SyncParams): Promise<SyncResult> {
  const { dataset, tableName, forceSync = false } = params;
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    console.log(`[Sync Service] Starting sync for table: ${tableName}`);
    
    const pool = await ensureDbInitialized();

    // ดึง sync config
    const configs = await pool.query(
      'SELECT * FROM sync_config WHERE table_name = $1',
      [tableName]
    );

    if (configs.rows.length === 0) {
      throw new Error('Sync config not found');
    }

    const config = configs.rows[0];
    
    // สร้าง log entry with complete info
    const logResult = await pool.query(
      `INSERT INTO sync_logs (status, table_name, folder_name, spreadsheet_id, sheet_name, started_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
      ['running', tableName, config.folder_name, config.spreadsheet_id, config.sheet_name]
    );
    logId = logResult.rows[0].id;
    
    const sheets = await getGoogleSheetsClient();

    // ใช้ค่า start_row และ has_header จาก config
    const configStartRow = config.start_row || 1;
    const configHasHeader = config.has_header !== undefined ? config.has_header : true;
    const dataStartRow = configHasHeader ? configStartRow + 1 : configStartRow;

    // 🚀 OPTIMIZATION: ตรวจสอบ checksum ก่อนเพื่อประหยัด API quota
    if (!forceSync) {
      try {
        console.log(`[Sync Service] Checking checksum for ${tableName}...`);
        
        // ดึง header range (ถ้ามี) หรือแถวแรก
        const headerRange = configHasHeader 
          ? `${config.sheet_name}!A${configStartRow}:ZZ${configStartRow}`
          : `${config.sheet_name}!A${dataStartRow}:ZZ${dataStartRow}`;
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheet_id,
          range: headerRange,
        });
        
        // นับจำนวนแถวโดยดึงคอลัมน์แรกเท่านั้น
        const allRowsRange = `${config.sheet_name}!A:A`;
        const countResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheet_id,
          range: allRowsRange,
        });
        
        const totalSheetRows = (countResponse.data.values || []).length;
        const currentRowCount = configHasHeader 
          ? Math.max(0, totalSheetRows - configStartRow)
          : Math.max(0, totalSheetRows - configStartRow + 1);
        const lastChecksum = config.last_checksum;
        const lastRowCount = config.last_row_count || 0;
        
        // ถ้าจำนวนแถวเท่าเดิม ให้เช็ค sample rows
        if (currentRowCount === lastRowCount && lastChecksum && currentRowCount > 0) {
          console.log(`[Sync Service] Row count unchanged (${currentRowCount}), checking sample...`);
          
          // ดึง sample: แถวแรก, กลาง, สุดท้าย
          const firstRowNum = dataStartRow;
          const middleRowNum = Math.max(dataStartRow, Math.floor((dataStartRow + currentRowCount - 1) / 2));
          const lastRowNum = dataStartRow + currentRowCount - 1;
          
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
            console.log(`[Sync Service] ✓ No changes detected, skipping sync`);
            
            // อัพเดท log - skipped
            if (logId) {
              await pool.query(
                `UPDATE sync_logs 
                 SET status = $1, completed_at = NOW(), sync_duration = 0, rows_synced = $2
                 WHERE id = $3`,
                ['skipped', currentRowCount, logId]
              );
            }
            
            return {
              success: true,
              message: 'No changes detected, sync skipped',
              stats: {
                inserted: 0,
                updated: 0,
                deleted: 0,
                total: currentRowCount
              }
            };
          } else {
            console.log(`[Sync Service] Changes detected, proceeding with full sync`);
          }
        } else {
          console.log(`[Sync Service] Row count changed (${lastRowCount} → ${currentRowCount}), syncing`);
        }
      } catch (checksumError: any) {
        console.error(`[Sync Service] Checksum error, proceeding with full sync:`, checksumError.message);
      }
    }

    // ดึงข้อมูลจาก Google Sheets เต็มรูปแบบ
    const range = `${config.sheet_name}!A${configStartRow}:ZZ`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheet_id,
      range: range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      throw new Error('No data found in sheet');
    }

    // แยก headers และ data rows ตาม has_header
    const headers = configHasHeader ? rows[0] : rows[0]; // ใช้แถวแรกเป็น template
    const dataRows = configHasHeader ? rows.slice(1) : rows;

    console.log(`[Sync Service] Processing ${dataRows.length} rows (has_header: ${configHasHeader})`);

    // นับจำนวนแถวเก่าเพื่อคำนวณ inserted/updated/deleted
    const oldCountResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const oldRowCount = parseInt(oldCountResult.rows[0]?.count || 0);

    // Simple sync logic - truncate และ insert ใหม่
    await pool.query(`TRUNCATE TABLE "${tableName}"`);
    
    let insertedCount = 0;
    for (const row of dataRows) {
      if (row.every((cell: any) => !cell)) continue;

      const rowData: any = {};
      headers.forEach((header: string, index: number) => {
        rowData[header.toLowerCase().replace(/[^a-z0-9_]/g, '_')] = row[index] || null;
      });

      const columns = Object.keys(rowData).map(k => `"${k}"`).join(', ');
      const placeholders = Object.keys(rowData).map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(rowData);

      try {
        await pool.query(
          `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`,
          values
        );
        insertedCount++;
      } catch (err) {
        console.error(`[Sync Service] Error inserting row:`, err);
      }
    }

    // คำนวณ inserted/updated/deleted เหมือน /api/sync-table
    let finalInserted = 0;
    let finalUpdated = 0;
    let finalDeleted = 0;
    
    if (dataRows.length > oldRowCount) {
      // มีแถวเพิ่มขึ้น = updated เก่า + inserted ใหม่
      finalUpdated = oldRowCount;
      finalInserted = dataRows.length - oldRowCount;
    } else if (dataRows.length < oldRowCount) {
      // แถวลดลง = updated + deleted
      finalUpdated = dataRows.length;
      finalDeleted = oldRowCount - dataRows.length;
    } else {
      // จำนวนเท่าเดิม = updated ทั้งหมด
      finalUpdated = dataRows.length;
    }

    // อัพเดท log - success
    if (logId) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await pool.query(
        `UPDATE sync_logs 
         SET status = $1, completed_at = NOW(), sync_duration = $2, 
             rows_synced = $3, rows_inserted = $4, rows_updated = $5, rows_deleted = $6
         WHERE id = $7`,
        ['success', duration, dataRows.length, finalInserted, finalUpdated, finalDeleted, logId]
      );
    }

    // คำนวณและบันทึก checksum สำหรับครั้งถัดไป
    const newChecksum = calculateChecksum([
      headers,
      dataRows[0] || [],
      dataRows[Math.floor(dataRows.length / 2)] || [],
      dataRows[dataRows.length - 1] || []
    ]);

    await pool.query(
      `UPDATE sync_config 
       SET last_sync = NOW(), last_checksum = $1, last_row_count = $2 
       WHERE table_name = $3`,
      [newChecksum, dataRows.length, tableName]
    );

    console.log(`[Sync Service] ✓ Completed: ${finalInserted} inserted, ${finalUpdated} updated, ${finalDeleted} deleted`);

    return {
      success: true,
      message: 'Sync completed successfully',
      stats: {
        inserted: finalInserted,
        updated: finalUpdated,
        deleted: finalDeleted,
        total: dataRows.length
      }
    };

  } catch (error: any) {
    console.error('[Sync Service] Error:', error);

    // อัพเดท log - error
    if (logId) {
      try {
        const pool = await ensureDbInitialized();
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await pool.query(
          `UPDATE sync_logs 
           SET status = $1, completed_at = NOW(), sync_duration = $2, error_message = $3
           WHERE id = $4`,
          ['error', duration, error.message, logId]
        );
      } catch (logError) {
        console.error('[Sync Service] Error updating log:', logError);
      }
    }

    return {
      success: false,
      error: error.message
    };
  }
}
