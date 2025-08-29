import pool from './db';
import googleSheetsService from './googleSheetsService';

// Import types
interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  columns: string | object;
  is_active: boolean;
  last_sync_at?: string;
  row_count?: number;
}

interface ColumnMapping {
  googleColumn: string;
  mysqlColumn: string;
  dataType: 'VARCHAR(255)' | 'INT' | 'TEXT' | 'DECIMAL(10,2)' | 'DATE' | 'DATETIME' | 'TIMESTAMP';
}

class SmartDeltaSyncService {
  private readonly BATCH_SIZE = 500; // ลดขนาด batch
  private readonly CHECK_BATCH_SIZE = 1000; // สำหรับ check changes
  private readonly MAX_CONCURRENT_SHEETS = 3; // ลด concurrent

  // ซิงค์อัจฉริยะ - เช็คเฉพาะที่เปลี่ยนแปลง
  async smartSync(configId: number): Promise<{
    success: boolean;
    message: string;
    stats: {
      totalChecked: number;
      newRows: number;
      changedRows: number;
      unchangedRows: number;
      deletedRows: number;
      performance: {
        checkDuration: number;
        syncDuration: number;
        totalDuration: number;
      };
    };
  }> {
    const startTime = Date.now();
    let connection;

    try {
      // 1. ดึงการตั้งค่า
      const config = await this.getSyncConfig(configId);
      if (!config) {
        throw new Error('Sync configuration not found');
      }

      console.log(`=== SMART DELTA SYNC CONFIG ${configId} ===`);
      console.log(`Syncing: ${config.name}`);

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 2. ตรวจสอบและเตรียม tracking structure
      await this.ensureSmartTrackingColumns(config.table_name, connection);

      // 3. ดึงข้อมูล metadata จาก Google Sheets (เฉพาะ modified time ถ้าได้)
      const checkStart = Date.now();
      
      // 4. เช็คข้อมูลในฐานข้อมูลปัจจุบัน
      const dbSnapshot = await this.getCurrentDatabaseSnapshot(config.table_name, connection);
      console.log(`Found ${dbSnapshot.size} existing rows in database`);

      // 5. ดึงข้อมูลจาก Google Sheets แต่เฉลียวฉลาด
      const sheetChanges = await this.detectSheetChanges(config, dbSnapshot);
      
      const checkDuration = Date.now() - checkStart;
      console.log(`Change detection completed in ${checkDuration}ms`);

      // 6. ประมวลผลเฉพาะที่เปลี่ยนแปลง
      const syncStart = Date.now();
      const syncResult = await this.applyChangesToDatabase(config, sheetChanges, connection);
      const syncDuration = Date.now() - syncStart;

      await connection.commit();
      const totalDuration = Date.now() - startTime;

      // 7. สรุปผลลัพธ์
      const stats = {
        totalChecked: sheetChanges.total,
        newRows: syncResult.inserted,
        changedRows: syncResult.updated,
        unchangedRows: syncResult.unchanged,
        deletedRows: syncResult.deleted,
        performance: {
          checkDuration,
          syncDuration,
          totalDuration
        }
      };

      const message = this.generateSummaryMessage(stats);
      console.log(`[Config ${configId}] ${message}`);

      return { success: true, message, stats };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error(`Smart sync error for config ${configId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        stats: {
          totalChecked: 0,
          newRows: 0,
          changedRows: 0,
          unchangedRows: 0,
          deletedRows: 0,
          performance: { checkDuration: 0, syncDuration: 0, totalDuration: Date.now() - startTime }
        }
      };
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // ตรวจจับการเปลี่ยนแปลงอย่างฉลาด
  private async detectSheetChanges(
    config: SyncConfig, 
    dbSnapshot: Map<number, any>
  ): Promise<{
    total: number;
    new: Array<{ rowIndex: number; data: any[] }>;
    changed: Array<{ rowIndex: number; data: any[]; oldHash: string }>;
    unchanged: number;
  }> {
    const columnsData = typeof config.columns === 'string' 
      ? JSON.parse(config.columns) 
      : config.columns;

    const columnMappings: ColumnMapping[] = Object.entries(columnsData).map(([googleCol, mysqlCol]) => ({
      googleColumn: googleCol,
      mysqlColumn: mysqlCol as string,
      dataType: this.detectColumnDataType(mysqlCol as string)
    }));

    // ดึงข้อมูลจาก Google Sheets แบบ smart chunking
    let currentRow = 1;
    let hasMoreData = true;
    let processedHeaders = false;
    
    const newRows = [];
    const changedRows = [];
    let unchangedCount = 0;
    let totalChecked = 0;

    while (hasMoreData) {
      const startRow = processedHeaders ? currentRow : 1;
      const endRow = startRow + this.CHECK_BATCH_SIZE - 1;
      const range = `${startRow}:${endRow}`;

      try {
        console.log(`Checking rows ${startRow} to ${endRow} for changes...`);
        const batchData = await googleSheetsService.getSheetData(config.sheet_url, config.sheet_name, range);

        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }

        // ข้าม header row ในครั้งแรก
        const dataToProcess = processedHeaders ? batchData : batchData.slice(1);
        const startRowIndex = processedHeaders ? startRow : 2;

        if (!processedHeaders) {
          processedHeaders = true;
        }

        // เช็คแต่ละแถวว่ามีการเปลี่ยนแปลงหรือไม่
        for (const [batchIndex, rowData] of dataToProcess.entries()) {
          const actualRowIndex = startRowIndex + batchIndex;
          totalChecked++;

          // สร้าง hash สำหรับแถวนี้
          const transformedRow = this.transformRowData(rowData, columnMappings);
          const rowHash = this.createRowHash(transformedRow, columnMappings.map(m => m.mysqlColumn));

          const existingRow = dbSnapshot.get(actualRowIndex);

          if (!existingRow) {
            // แถวใหม่
            newRows.push({
              rowIndex: actualRowIndex,
              data: rowData
            });
          } else if (existingRow.row_hash !== rowHash) {
            // แถวที่มีการเปลี่ยนแปลง
            changedRows.push({
              rowIndex: actualRowIndex,
              data: rowData,
              oldHash: existingRow.row_hash
            });
          } else {
            // ไม่มีการเปลี่ยนแปลง
            unchangedCount++;
          }
        }

        // เช็คว่ามีข้อมูลน้อยกว่า batch size = จบแล้ว
        if (batchData.length < this.CHECK_BATCH_SIZE) {
          hasMoreData = false;
        }

        currentRow = endRow + 1;

        // หน่วงเวลาเพื่อลด load
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`Error checking batch starting at row ${startRow}:`, error);
        hasMoreData = false;
      }
    }

    console.log(`Change detection summary: ${newRows.length} new, ${changedRows.length} changed, ${unchangedCount} unchanged`);

    return {
      total: totalChecked,
      new: newRows,
      changed: changedRows,
      unchanged: unchangedCount
    };
  }

  // นำการเปลี่ยนแปลงมาใช้กับฐานข้อมูล
  private async applyChangesToDatabase(
    config: SyncConfig,
    changes: any,
    connection: any
  ): Promise<{ inserted: number; updated: number; unchanged: number; deleted: number }> {
    const columnsData = typeof config.columns === 'string' 
      ? JSON.parse(config.columns) 
      : config.columns;

    const columnMappings: ColumnMapping[] = Object.entries(columnsData).map(([googleCol, mysqlCol]) => ({
      googleColumn: googleCol,
      mysqlColumn: mysqlCol as string,
      dataType: this.detectColumnDataType(mysqlCol as string)
    }));

    const columns = columnMappings.map(m => m.mysqlColumn);
    let inserted = 0;
    let updated = 0;

    // 1. INSERT แถวใหม่ (ทำเป็น batch เพื่อเพิ่มประสิทธิภาพ)
    if (changes.new.length > 0) {
      console.log(`Inserting ${changes.new.length} new rows...`);
      
      const safeColumns = columns.map(col => `\`${col}\``);
      const placeholders = columns.map(() => '?').join(', ');
      
      const insertSQL = `
        INSERT INTO \`${config.table_name}\` (${safeColumns.join(', ')}, sheet_row_index, row_hash, synced_at)
        VALUES (${placeholders}, ?, ?, NOW())
      `;

      // แบ่งเป็น batches เพื่อไม่ให้ query ใหญ่เกินไป
      for (let i = 0; i < changes.new.length; i += this.BATCH_SIZE) {
        const batch = changes.new.slice(i, i + this.BATCH_SIZE);
        
        for (const newRow of batch) {
          const transformedRow = this.transformRowData(newRow.data, columnMappings);
          const values = columns.map(col => transformedRow[col]);
          const rowHash = this.createRowHash(transformedRow, columns);

          await connection.execute(insertSQL, [...values, newRow.rowIndex, rowHash]);
          inserted++;
        }

        // หน่วงเวลาระหว่าง batch
        if (i + this.BATCH_SIZE < changes.new.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    // 2. UPDATE แถวที่เปลี่ยนแปลง
    if (changes.changed.length > 0) {
      console.log(`Updating ${changes.changed.length} changed rows...`);
      
      const updateSQL = `
        UPDATE \`${config.table_name}\` 
        SET ${columns.map(col => `\`${col}\` = ?`).join(', ')}, row_hash = ?, synced_at = NOW()
        WHERE sheet_row_index = ?
      `;

      for (const changedRow of changes.changed) {
        const transformedRow = this.transformRowData(changedRow.data, columnMappings);
        const values = columns.map(col => transformedRow[col]);
        const newRowHash = this.createRowHash(transformedRow, columns);

        await connection.execute(updateSQL, [...values, newRowHash, changedRow.rowIndex]);
        updated++;

        // หน่วงเวลาเล็กน้อย
        if (updated % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
    }

    // 3. ตรวจจับแถวที่ถูกลบ (optional - อาจจะเป็น feature เสริม)
    // TODO: Implement deleted row detection if needed

    return {
      inserted,
      updated,
      unchanged: changes.unchanged,
      deleted: 0 // For now
    };
  }

  // ดึงข้อมูลปัจจุบันจากฐานข้อมูลเป็น snapshot
  private async getCurrentDatabaseSnapshot(tableName: string, connection: any): Promise<Map<number, any>> {
    const [rows] = await connection.execute(`
      SELECT sheet_row_index, row_hash, synced_at 
      FROM \`${tableName}\` 
      WHERE sheet_row_index IS NOT NULL
      ORDER BY sheet_row_index
    `);

    const snapshot = new Map();
    (rows as any[]).forEach(row => {
      snapshot.set(row.sheet_row_index, row);
    });

    return snapshot;
  }

  // เพิ่ม smart tracking columns
  private async ensureSmartTrackingColumns(tableName: string, connection: any): Promise<void> {
    try {
      // เช็ค existing columns
      const [columns] = await connection.execute(`
        SHOW COLUMNS FROM \`${tableName}\`
      `);

      const existingColumns = (columns as any[]).map(col => col.Field.toLowerCase());
      
      const requiredColumns = [
        { name: 'sheet_row_index', type: 'INT' },
        { name: 'row_hash', type: 'VARCHAR(32)' },
        { name: 'synced_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];

      const alterStatements: string[] = [];
      
      requiredColumns.forEach(col => {
        if (!existingColumns.includes(col.name.toLowerCase())) {
          alterStatements.push(`ADD COLUMN ${col.name} ${col.type}`);
        }
      });

      if (alterStatements.length > 0) {
        await connection.execute(`
          ALTER TABLE \`${tableName}\` 
          ${alterStatements.join(', ')},
          ADD INDEX idx_sheet_row_index (sheet_row_index),
          ADD INDEX idx_row_hash (row_hash),
          ADD INDEX idx_synced_at (synced_at)
        `);
        console.log(`Added smart tracking columns to ${tableName}`);
      }
    } catch (error) {
      console.error(`Error ensuring smart tracking columns for ${tableName}:`, error);
      throw error;
    }
  }

  // Helper functions
  private async getSyncConfig(configId: number): Promise<SyncConfig | null> {
    const [rows] = await pool.execute(`
      SELECT * FROM sync_configs WHERE id = ?
    `, [configId]);

    const configs = rows as any[];
    return configs.length > 0 ? configs[0] : null;
  }

  private transformRowData(rowData: any[], columnMappings: ColumnMapping[]): any {
    const transformed: any = {};
    
    columnMappings.forEach((mapping, index) => {
      if (index < rowData.length) {
        let value = rowData[index];
        
        // ประมวลผลค่าตามประเภท
        if (mapping.dataType === 'DATETIME' || mapping.dataType === 'DATE') {
          value = this.processDateValue(value);
        }
        
        transformed[mapping.mysqlColumn] = value;
      } else {
        transformed[mapping.mysqlColumn] = null;
      }
    });

    return transformed;
  }

  private createRowHash(transformedRow: any, columns: string[]): string {
    // สร้าง normalized values สำหรับ hash
    const normalizedValues = columns.map(col => {
      const val = transformedRow[col];
      if (val instanceof Date) {
        return val.toISOString().substring(0, 10); // YYYY-MM-DD only
      }
      return val === null || val === undefined ? '' : String(val);
    });

    const rowData = columns.map((col, index) => `${col}:${normalizedValues[index]}`).join('|');
    return require('crypto').createHash('md5').update(rowData, 'utf8').digest('hex');
  }

  private processDateValue(value: any): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      // รูปแบบ YYYY-MM-DD
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

    return value;
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

  private generateSummaryMessage(stats: any): string {
    const { newRows, changedRows, unchangedRows, totalChecked, performance } = stats;
    
    if (newRows === 0 && changedRows === 0) {
      return `No changes detected (${unchangedRows} unchanged) in ${performance.totalDuration}ms`;
    }

    const changes = [];
    if (newRows > 0) changes.push(`${newRows} inserted`);
    if (changedRows > 0) changes.push(`${changedRows} updated`);
    if (unchangedRows > 0) changes.push(`${unchangedRows} unchanged`);

    return `Smart sync: ${changes.join(', ')} from ${totalChecked} rows in ${performance.totalDuration}ms`;
  }

  // สำหรับ bulk smart sync
  async smartSyncMultiple(configIds: number[]): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{
      configId: number;
      success: boolean;
      message: string;
      stats: any;
    }>;
    totalStats: {
      totalChecked: number;
      totalNewRows: number;
      totalChangedRows: number;
      totalUnchangedRows: number;
      totalDuration: number;
    };
  }> {
    const startTime = Date.now();
    console.log(`Starting smart bulk sync for ${configIds.length} configurations...`);

    const results: Array<{
      configId: number;
      success: boolean;
      message: string;
      stats: any;
    }> = [];
    let successCount = 0;
    let failedCount = 0;
    
    let totalChecked = 0;
    let totalNewRows = 0;
    let totalChangedRows = 0;
    let totalUnchangedRows = 0;

    // ประมวลผลเป็น batches เพื่อไม่ให้เซิร์ฟเวอร์ล้น
    for (let i = 0; i < configIds.length; i += this.MAX_CONCURRENT_SHEETS) {
      const batch = configIds.slice(i, i + this.MAX_CONCURRENT_SHEETS);
      console.log(`Processing smart sync batch: configs ${batch.join(', ')}`);

      const batchPromises = batch.map(async (configId) => {
        try {
          const result = await this.smartSync(configId);
          
          if (result.success) {
            successCount++;
            totalChecked += result.stats.totalChecked;
            totalNewRows += result.stats.newRows;
            totalChangedRows += result.stats.changedRows;
            totalUnchangedRows += result.stats.unchangedRows;
          } else {
            failedCount++;
          }

          return {
            configId,
            success: result.success,
            message: result.message,
            stats: result.stats
          };
        } catch (error) {
          failedCount++;
          return {
            configId,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            stats: null
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // หน่วงเวลาระหว่าง batches
      if (i + this.MAX_CONCURRENT_SHEETS < configIds.length) {
        console.log('Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`Smart bulk sync completed in ${totalDuration}ms: ${successCount} success, ${failedCount} failed`);

    return {
      total: configIds.length,
      success: successCount,
      failed: failedCount,
      results,
      totalStats: {
        totalChecked,
        totalNewRows,
        totalChangedRows,
        totalUnchangedRows,
        totalDuration
      }
    };
  }
}

export default new SmartDeltaSyncService();
