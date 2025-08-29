import pool from './db';
import googleSheetsService, { SyncConfig, ColumnMapping } from './googleSheetsService';

class LargeSyncService {
  private readonly BATCH_SIZE = 1000;
  private readonly MAX_CONCURRENT_SYNCS = 5; // ซิงค์พร้อมกัน max 5 ชีต
  private readonly API_DELAY = 200; // หน่วงเวลาระหว่าง API calls (ms)

  // ซิงค์หลายชีตแบบ batch processing
  async syncMultipleSheets(configIds: number[]): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{
      configId: number;
      success: boolean;
      message: string;
      rowsProcessed: number;
      duration: number;
    }>;
  }> {
    const startTime = Date.now();
    console.log(`Starting large scale sync for ${configIds.length} sheets...`);

    const results: Array<{
      configId: number;
      success: boolean;
      message: string;
      rowsProcessed: number;
      duration: number;
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    // แบ่งเป็น batches เพื่อไม่ให้เกิน concurrent limit
    for (let i = 0; i < configIds.length; i += this.MAX_CONCURRENT_SYNCS) {
      const batch = configIds.slice(i, i + this.MAX_CONCURRENT_SYNCS);
      console.log(`Processing batch ${Math.floor(i / this.MAX_CONCURRENT_SYNCS) + 1}: configs ${batch.join(', ')}`);

      // ประมวลผล batch นี้แบบ parallel
      const batchPromises = batch.map(async (configId) => {
        const syncStart = Date.now();
        try {
          const result = await this.syncLargeSheet(configId);
          const duration = Date.now() - syncStart;
          
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }

          return {
            configId,
            success: result.success,
            message: result.message,
            rowsProcessed: result.rowsSynced,
            duration
          };
        } catch (error) {
          failedCount++;
          return {
            configId,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            rowsProcessed: 0,
            duration: Date.now() - syncStart
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // รวมผลลัพธ์
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failedCount++;
          results.push({
            configId: batch[results.length - successCount - failedCount],
            success: false,
            message: result.reason?.message || 'Promise rejected',
            rowsProcessed: 0,
            duration: 0
          });
        }
      });

      // หน่วงเวลาก่อน batch ถัดไป
      if (i + this.MAX_CONCURRENT_SYNCS < configIds.length) {
        console.log(`Waiting ${this.API_DELAY}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.API_DELAY));
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`Large scale sync completed in ${totalDuration}ms: ${successCount} success, ${failedCount} failed`);

    return {
      total: configIds.length,
      success: successCount,
      failed: failedCount,
      results
    };
  }

  // ซิงค์ชีตขนาดใหญ่แบบ incremental streaming
  async syncLargeSheet(configId: number): Promise<{
    success: boolean;
    message: string;
    rowsSynced: number;
  }> {
    let connection;
    try {
      // ดึงการตั้งค่า
      const [configs] = await pool.execute(`
        SELECT * FROM sync_configs WHERE id = ?
      `, [configId]);

      if ((configs as any[]).length === 0) {
        throw new Error('Sync configuration not found');
      }

      const config = (configs as any[])[0];
      console.log(`=== LARGE INCREMENTAL SYNC CONFIG ${configId} ===`);
      console.log(`Syncing: ${config.name}`);

      // ตรวจสอบ column mapping
      const columnsData = typeof config.columns === 'string' 
        ? JSON.parse(config.columns) 
        : config.columns;

      const columnMappings: ColumnMapping[] = Object.entries(columnsData).map(([googleCol, mysqlCol]) => ({
        googleColumn: googleCol,
        mysqlColumn: mysqlCol as string,
        dataType: this.detectColumnDataType(mysqlCol as string) as 'VARCHAR(255)' | 'INT' | 'TEXT' | 'DECIMAL(10,2)' | 'DATE' | 'DATETIME' | 'TIMESTAMP'
      }));

      // เริ่ม transaction
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // ตรวจสอบและเพิ่ม tracking columns
      await this.ensureTrackingColumns(config.table_name, connection);

      // ดึงข้อมูล existing rows เป็น Map
      const existingRows = await this.getExistingRowsMap(config.table_name, connection);
      console.log(`Found ${existingRows.size} existing rows in database`);

      let totalRowsProcessed = 0;
      let rowsInserted = 0;
      let rowsUpdated = 0;
      let unchangedRows = 0;

      // ดึงข้อมูลจาก Google Sheets แบบ streaming
      await this.processSheetInBatches(
        config.sheet_url,
        config.sheet_name,
        columnMappings,
        existingRows,
        config.table_name,
        connection,
        (stats) => {
          totalRowsProcessed += stats.processed;
          rowsInserted += stats.inserted;
          rowsUpdated += stats.updated;
          unchangedRows += stats.unchanged;
        }
      );

      await connection.commit();

      const totalChanges = rowsInserted + rowsUpdated;
      const message = totalChanges > 0 
        ? `${totalChanges} rows synced (${rowsInserted} inserted, ${rowsUpdated} updated, ${unchangedRows} unchanged)`
        : `No changes detected (${unchangedRows} unchanged)`;

      console.log(`[Config ${configId}] ${message}`);

      return {
        success: true,
        message,
        rowsSynced: totalChanges
      };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error(`Large sync error for config ${configId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        rowsSynced: 0
      };
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // ประมวลผลชีตเป็น batches
  private async processSheetInBatches(
    sheetUrl: string,
    sheetName: string,
    columnMappings: ColumnMapping[],
    existingRows: Map<number, any>,
    tableName: string,
    connection: any,
    onProgress: (stats: { processed: number; inserted: number; updated: number; unchanged: number }) => void
  ) {
    // ดึงข้อมูลแบบ streaming chunks
    let currentBatch = 1;
    let hasMoreData = true;
    let processedHeaders = false;
    
    while (hasMoreData) {
      const startRow = processedHeaders ? (currentBatch - 1) * this.BATCH_SIZE + 2 : 1;
      const endRow = processedHeaders ? currentBatch * this.BATCH_SIZE + 1 : this.BATCH_SIZE + 1;
      const range = `${startRow}:${endRow}`;
      
      console.log(`Processing batch ${currentBatch}: rows ${startRow} to ${endRow}`);
      
      try {
        const batchData = await googleSheetsService.getSheetData(sheetUrl, sheetName, range);
        
        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        // ประมวลผล headers ในครั้งแรก
        if (!processedHeaders && batchData.length > 0) {
          processedHeaders = true;
          // Skip header row สำหรับ batch ถัดไป
          if (batchData.length > 1) {
            const dataRows = batchData.slice(1);
            const stats = await this.processBatchData(
              dataRows, 
              columnMappings, 
              existingRows, 
              tableName, 
              connection,
              2 // เริ่มจาก row 2
            );
            onProgress(stats);
          }
        } else {
          // ประมวลผลข้อมูลปกติ
          const stats = await this.processBatchData(
            batchData, 
            columnMappings, 
            existingRows, 
            tableName, 
            connection,
            startRow
          );
          onProgress(stats);
        }

        // เช็คว่ามีข้อมูลน้อยกว่า batch size = จบแล้ว
        if (batchData.length < this.BATCH_SIZE) {
          hasMoreData = false;
        }

        currentBatch++;
        
        // หน่วงเวลาระหว่าง batches
        await new Promise(resolve => setTimeout(resolve, this.API_DELAY));
        
      } catch (error) {
        console.error(`Error processing batch ${currentBatch}:`, error);
        // อาจจะ retry หรือ skip batch นี้
        hasMoreData = false;
      }
    }
  }

  // ประมวลผลข้อมูลใน batch เดียว
  private async processBatchData(
    batchData: any[][],
    columnMappings: ColumnMapping[],
    existingRows: Map<number, any>,
    tableName: string,
    connection: any,
    startRowIndex: number
  ): Promise<{ processed: number; inserted: number; updated: number; unchanged: number }> {
    
    const columns = columnMappings.map(m => m.mysqlColumn);
    const safeColumns = columns.map(col => `\`${col}\``);
    const placeholders = columns.map(() => '?').join(', ');
    
    const insertSQL = `
      INSERT INTO \`${tableName}\` (${safeColumns.join(', ')}, sheet_row_index, row_hash)
      VALUES (${placeholders}, ?, ?)
    `;

    const updateSQL = `
      UPDATE \`${tableName}\` SET ${columns.map(col => `\`${col}\` = ?`).join(', ')}, row_hash = ?
      WHERE sheet_row_index = ?
    `;

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    // Transform ข้อมูลทั้ง batch
    const transformedBatch = googleSheetsService.transformDataForMySQL(batchData, columnMappings);

    // ประมวลผลทีละ row
    for (const [batchIndex, row] of transformedBatch.entries()) {
      const sheetRowIndex = startRowIndex + batchIndex;
      
      // สร้าง values และ hash
      const values = columns.map(col => {
        const value = row[col];
        return this.processDateValue(value, col);
      });

      const normalizedValues = values.map(val => 
        val instanceof Date ? val.toISOString().substring(0, 10) : 
        (val === null || val === undefined) ? null : String(val)
      );

      const rowData = columns.map((col, index) => `${col}:${normalizedValues[index]}`).join('|');
      const rowHash = require('crypto').createHash('md5').update(rowData).digest('hex');

      const existingRow = existingRows.get(sheetRowIndex);

      if (!existingRow) {
        // Insert ใหม่
        await connection.execute(insertSQL, [...values, sheetRowIndex, rowHash]);
        inserted++;
      } else if (existingRow.row_hash !== rowHash) {
        // Update
        await connection.execute(updateSQL, [...values, rowHash, sheetRowIndex]);
        updated++;
      } else {
        // ไม่เปลี่ยนแปลง
        unchanged++;
      }
    }

    return {
      processed: batchData.length,
      inserted,
      updated,
      unchanged
    };
  }

  // ดึง existing rows เป็น Map สำหรับการค้นหาที่เร็ว
  private async getExistingRowsMap(tableName: string, connection: any): Promise<Map<number, any>> {
    const [rows] = await connection.execute(`
      SELECT sheet_row_index, row_hash FROM \`${tableName}\`
      WHERE sheet_row_index IS NOT NULL
    `);

    const map = new Map();
    (rows as any[]).forEach(row => {
      map.set(row.sheet_row_index, row);
    });

    return map;
  }

  // คัดลอก helper functions จาก syncService
  private async ensureTrackingColumns(tableName: string, connection: any): Promise<void> {
    try {
      // เช็คว่ามี column sheet_row_index หรือยัง
      const [columns] = await connection.execute(`
        SHOW COLUMNS FROM \`${tableName}\` LIKE 'sheet_row_index'
      `);

      if ((columns as any[]).length === 0) {
        await connection.execute(`
          ALTER TABLE \`${tableName}\` 
          ADD COLUMN sheet_row_index INT,
          ADD COLUMN row_hash VARCHAR(32),
          ADD INDEX idx_sheet_row_index (sheet_row_index),
          ADD INDEX idx_row_hash (row_hash)
        `);
        console.log(`Added tracking columns to ${tableName}`);
      }
    } catch (error) {
      console.error(`Error ensuring tracking columns for ${tableName}:`, error);
      throw error;
    }
  }

  private detectColumnDataType(columnName: string): 'VARCHAR(255)' | 'INT' | 'TEXT' | 'DECIMAL(10,2)' | 'DATE' | 'DATETIME' | 'TIMESTAMP' {
    const name = columnName.toLowerCase();
    if (name.includes('date') || name.includes('time') || name === 'created_at' || name === 'updated_at') {
      return 'DATETIME';
    }
    if (name.includes('price') || name.includes('amount') || name.includes('total') || name.includes('cost')) {
      return 'DECIMAL(10,2)';
    }
    if (name.includes('count') || name.includes('number') || name.includes('id') || name === 'age') {
      return 'INT';
    }
    return 'VARCHAR(255)';
  }

  private processDateValue(value: any, columnName: string): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const dataType = this.detectColumnDataType(columnName);
    
    if (dataType === 'DATETIME') {
      if (value instanceof Date) {
        return value;
      }
      
      if (typeof value === 'string') {
        // ลองแปลงรูปแบบต่างๆ
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return new Date(value + ' 00:00:00');
        }
        
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      if (typeof value === 'number') {
        // Excel serial date
        const date = new Date((value - 25569) * 86400 * 1000);
        return date;
      }
    }
    
    return value;
  }
}

export default new LargeSyncService();
