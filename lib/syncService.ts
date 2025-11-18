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

    // ดึงข้อมูลจาก Google Sheets
    const range = `${config.sheet_name}!A:ZZ`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheet_id,
      range: range,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      throw new Error('No data found in sheet');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`[Sync Service] Processing ${dataRows.length} rows`);

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

    // อัพเดท log - success
    if (logId) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await pool.query(
        `UPDATE sync_logs 
         SET status = $1, completed_at = NOW(), sync_duration = $2, 
             rows_synced = $3, rows_inserted = $4, rows_updated = $5, rows_deleted = $6
         WHERE id = $7`,
        ['success', duration, dataRows.length, insertedCount, 0, 0, logId]
      );
    }

    console.log(`[Sync Service] ✓ Completed: ${insertedCount} rows inserted`);

    return {
      success: true,
      message: 'Sync completed successfully',
      stats: {
        inserted: insertedCount,
        updated: 0,
        deleted: 0,
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
