import pool from './db';
import googleSheetsService, { SyncConfig, ColumnMapping } from './googleSheetsService';

class SyncService {
  
  // ฟังก์ชันสำหรับทำความสะอาดชื่อ column
  private sanitizeColumnName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_ก-๙]/g, '_') // แทนที่อักขระพิเศษด้วย _
      .replace(/_{2,}/g, '_') // ลด _ ซ้อนเป็น _ เดียว
      .replace(/^_|_$/g, '') // ลบ _ ที่ต้นและท้าย
      .toLowerCase() // เป็นตัวเล็ก
      .substring(0, 64) // จำกัดความยาว
      || 'col_' + Math.random().toString(36).substr(2, 8); // ถ้าว่างเปล่า
  }
  async getAllSyncConfigs(): Promise<SyncConfig[]> {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM sync_configs WHERE is_active = true ORDER BY created_at DESC
      `);
      return rows as SyncConfig[];
    } catch (error) {
      console.error('Error fetching sync configs:', error);
      return [];
    }
  }

  // เพิ่มการตั้งค่า sync ใหม่
  async createSyncConfig(config: Omit<SyncConfig, 'id' | 'last_sync_at' | 'row_count'>): Promise<number> {
    try {
      // ทำความสะอาดชื่อ column
      const cleanedColumns: { [key: string]: string } = {};
      Object.entries(config.columns).forEach(([googleCol, mysqlCol]) => {
        const cleanMysqlCol = this.sanitizeColumnName(mysqlCol);
        cleanedColumns[googleCol] = cleanMysqlCol;
      });

      console.log('Original columns:', config.columns);
      console.log('Cleaned columns:', cleanedColumns);

      const [result] = await pool.execute(`
        INSERT INTO sync_configs (name, sheet_url, sheet_name, table_name, columns, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        config.name,
        config.sheet_url,
        config.sheet_name,
        config.table_name,
        JSON.stringify(cleanedColumns),
        config.is_active
      ]);
      
      return (result as any).insertId;
    } catch (error) {
      console.error('Error creating sync config:', error);
      throw error;
    }
  }

  // ลบการตั้งค่า sync
  async deleteSyncConfig(configId: number): Promise<void> {
    try {
      // ตรวจสอบว่า config มีอยู่จริง
      const [configs] = await pool.execute(`
        SELECT id, table_name FROM sync_configs WHERE id = ?
      `, [configId]);

      if ((configs as any[]).length === 0) {
        throw new Error(`Sync config with ID ${configId} not found`);
      }

      const config = (configs as any[])[0];

      // ลบ sync config จาก database
      await pool.execute(`
        DELETE FROM sync_configs WHERE id = ?
      `, [configId]);

      console.log(`Sync config ${configId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting sync config:', error);
      throw error;
    }
  }

  // สร้างตารางใน MySQL ตามการตั้งค่า
  async createMySQLTable(tableName: string, columns: ColumnMapping[]): Promise<void> {
    try {
      // ตรวจสอบว่าตารางมีอยู่แล้วหรือไม่
      const [existing] = await pool.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `, [tableName]);

      if ((existing as any)[0].count > 0) {
        throw new Error(`Table ${tableName} already exists`);
      }

      // ทำความสะอาดชื่อ column และสร้าง SQL
      const cleanedColumns = columns.map(col => {
        const cleanName = this.sanitizeColumnName(col.mysqlColumn);
        return `\`${cleanName}\` ${col.dataType}`;
      }).join(', ');

      const createTableSQL = `
        CREATE TABLE \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ${cleanedColumns},
          sheet_row_index INT DEFAULT NULL,
          row_hash VARCHAR(32) DEFAULT NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sheet_row (sheet_row_index),
          INDEX idx_row_hash (row_hash)
        )
      `;

      console.log('Create table SQL:', createTableSQL);
      await pool.execute(createTableSQL);
      console.log(`Table ${tableName} created successfully with tracking columns`);
    } catch (error) {
      console.error('Error creating MySQL table:', error);
      throw error;
    }
  }

  // สร้าง hash จากข้อมูลแถว
  private createRowHash(data: any[]): string {
    const crypto = require('crypto');
    const rowString = data.join('|');
    return crypto.createHash('md5').update(rowString, 'utf8').digest('hex');
  }

  // ตรวจสอบว่าตารางมี column สำหรับ tracking หรือไม่
  private async ensureTrackingColumns(tableName: string, connection: any): Promise<void> {
    try {
      // ตรวจสอบและเพิ่ม sheet_row_index column
      const [indexColumn] = await connection.execute(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'sheet_row_index'
      `, [tableName]);

      if ((indexColumn as any[]).length === 0) {
        await connection.execute(`
          ALTER TABLE \`${tableName}\` ADD COLUMN sheet_row_index INT DEFAULT NULL
        `);
        console.log(`Added sheet_row_index column to ${tableName}`);
      }

      // ตรวจสอบและเพิ่ม row_hash column
      const [hashColumn] = await connection.execute(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'row_hash'
      `, [tableName]);

      if ((hashColumn as any[]).length === 0) {
        await connection.execute(`
          ALTER TABLE \`${tableName}\` ADD COLUMN row_hash VARCHAR(32) DEFAULT NULL
        `);
        console.log(`Added row_hash column to ${tableName}`);
      }

    } catch (error) {
      console.error('Error ensuring tracking columns:', error);
      // ไม่ throw error เพื่อให้ sync ดำเนินต่อไปได้
    }
  }

  // ตรวจจับประเภทข้อมูลจากชื่อ column
  private detectColumnDataType(columnName: string): ColumnMapping['dataType'] {
    const lowerName = columnName.toLowerCase();
    
    // ตรวจจับ DATE columns
    if (lowerName.includes('date') || lowerName.includes('วันที่') || 
        lowerName === 'created_at' || lowerName === 'updated_at') {
      return 'DATETIME';
    }
    
    // ตรวจจับ ID columns
    if (lowerName.includes('id') || lowerName.includes('รหัส') || lowerName.includes('เลขที่')) {
      return 'INT';
    }
    
    // ตรวจจับ DECIMAL columns (เงิน, ราคา, ยอด)
    if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('total') || 
        lowerName.includes('ราคา') || lowerName.includes('ยอด') || lowerName.includes('จำนวนเงิน')) {
      return 'DECIMAL(10,2)';
    }
    
    // ตรวจจับ TEXT columns (รายละเอียด, หมายเหตุ)
    if (lowerName.includes('detail') || lowerName.includes('description') || lowerName.includes('note') ||
        lowerName.includes('รายละเอียด') || lowerName.includes('หมายเหตุ') || lowerName.includes('ข้อมูล')) {
      return 'TEXT';
    }
    
    // Default
    return 'VARCHAR(255)';
  }

  // แปลงค่าวันที่จาก Google Sheets ให้เป็นรูปแบบที่ MySQL รับได้
  private processDateValue(value: any, dataType?: string): any {
    if (!value || value === '') return null;
    
    // ถ้าไม่ใช่ column ประเภทวันที่ ให้ return ค่าเดิม
    if (dataType !== 'DATE' && dataType !== 'DATETIME' && dataType !== 'TIMESTAMP') {
      return value;
    }
    
    // ถ้าเป็น string ที่มี format วันที่
    if (typeof value === 'string') {
      // รองรับรูปแบบ yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (dataType === 'DATE') {
          return value; // MySQL DATE column รับ 'YYYY-MM-DD' ได้
        } else {
          return value + ' 00:00:00'; // สำหรับ DATETIME
        }
      }
      
      // รองรับรูปแบบ dd/mm/yyyy หรือ mm/dd/yyyy
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        const parts = value.split('/');
        // สมมติว่าเป็น dd/mm/yyyy format (Thailand)
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          const dateStr = `${year}-${month}-${day}`;
          return dataType === 'DATE' ? dateStr : dateStr + ' 00:00:00';
        }
      }
    }
    
    // ถ้าเป็น Date object หรือ timestamp
    if (value instanceof Date || (!isNaN(Date.parse(value)) && typeof value === 'string' && value.includes('GMT'))) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // ใช้ UTC date เพื่อหลีกเลี่ยงปัญหา timezone
        const utcYear = date.getUTCFullYear();
        const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
        const utcDay = String(date.getUTCDate()).padStart(2, '0');
        const dateStr = `${utcYear}-${utcMonth}-${utcDay}`;
        
        if (dataType === 'DATE') {
          return dateStr;
        } else {
          // สำหรับ DATETIME - ใช้เวลา 00:00:00 เพื่อความสม่ำเสมอ
          return dateStr + ' 00:00:00';
        }
      }
    }
    
    return value;
  }

  // ตรวจสอบความถูกต้องของ column mapping
  private validateColumnMapping(columns: any): boolean {
    try {
      // ตรวจสอบว่าเป็น object
      if (typeof columns !== 'object' || Array.isArray(columns) || columns === null) {
        console.error('Invalid columns format: not an object');
        return false;
      }

      const keys = Object.keys(columns);
      const values = Object.values(columns);

      // ตรวจสอบว่าไม่ว่าง
      if (keys.length === 0) {
        console.error('Invalid columns: empty object');
        return false;
      }

      // ตรวจสอบ key ที่เป็นอักขระพิเศษ (JSON characters)
      const invalidKeys = keys.filter(key => 
        key.includes('{') || key.includes('"') || key.includes(':') || 
        key.includes(',') || key.includes('}') || key.length < 2 ||
        /^\d+$/.test(key) // ตัวเลขเพียงอย่างเดียว
      );

      if (invalidKeys.length > 0) {
        console.error('Invalid column keys found:', invalidKeys);
        return false;
      }

      // ตรวจสอบ value ที่เป็นอักขระพิเศษ
      const invalidValues = values.filter((value: any) => 
        typeof value !== 'string' || value.length < 1 ||
        value.includes('{') || value.includes('"') || value.includes(':') || 
        value.includes(',') || value.includes('}')
      );

      if (invalidValues.length > 0) {
        console.error('Invalid column values found:', invalidValues);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating column mapping:', error);
      return false;
    }
  }

  // ซิงค์ข้อมูลแบบ Incremental (ติดตาม row_hash และ sheet_row_index) - มี Smart Mode
  async syncData(configId: number, smartMode: boolean = false): Promise<{ success: boolean; message: string; rowsSynced: number }> {
    // ถ้าเป็น smart mode ให้ใช้ smartDeltaSyncService แทน
    if (smartMode) {
      const smartDeltaSyncService = await import('./smartDeltaSyncService');
      const result = await smartDeltaSyncService.default.smartSync(configId);
      
      return {
        success: result.success,
        message: result.message,
        rowsSynced: result.stats.newRows + result.stats.changedRows
      };
    }

    // ต่อด้วย standard sync logic เดิม
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
      
      // ตรวจสอบความถูกต้องของ column mapping
      const columnsData = typeof config.columns === 'string' 
        ? JSON.parse(config.columns) 
        : config.columns;

      if (!this.validateColumnMapping(columnsData)) {
        throw new Error(`Invalid column mapping for config ${configId}. Please recreate this sync configuration.`);
      }

      const columnMappings: ColumnMapping[] = Object.entries(columnsData).map(([googleCol, mysqlCol]) => ({
        googleColumn: googleCol,
        mysqlColumn: mysqlCol as string,
        dataType: this.detectColumnDataType(mysqlCol as string) // ตรวจจับประเภทข้อมูลจากชื่อ column
      }));

      // ดึงข้อมูลจาก Google Sheets พร้อมแปลงข้อมูลทันที
      const sheetData = await googleSheetsService.getSheetData(config.sheet_url, config.sheet_name);
      
      if (sheetData.length === 0) {
        return { success: true, message: 'No data to sync', rowsSynced: 0 };
      }

      // แปลงข้อมูลโดยใช้ method ใหม่ที่ป้องกัน type mismatch
      // เนื่องจาก getSheetData ส่งคืนเป็น object ให้เราแปลงข้อมูลเองที่นี่
      const transformedData = sheetData.map((row: any) => {
        const convertedRow: any = {};
        columnMappings.forEach(mapping => {
          const value = row[mapping.googleColumn] || '';
          convertedRow[mapping.mysqlColumn] = googleSheetsService.convertCellValue(value, mapping.dataType);
        });
        return convertedRow;
      });

      // เริ่ม transaction
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // ตรวจสอบและเพิ่ม tracking columns
      await this.ensureTrackingColumns(config.table_name, connection);

      // ดึงข้อมูลปัจจุบันจาก database พร้อม hash และ row_index
      const [existingRows] = await connection.execute(`
        SELECT id, sheet_row_index, row_hash FROM \`${config.table_name}\`
      `);
      const existingData = existingRows as any[];

      // สร้าง Map สำหรับเปรียบเทียบ
      const existingByRowIndex = new Map();
      const existingHashes = new Set();
      
      existingData.forEach(row => {
        if (row.sheet_row_index !== null) {
          existingByRowIndex.set(row.sheet_row_index, row);
        }
        if (row.row_hash) {
          existingHashes.add(row.row_hash);
        }
      });

      const columns = columnMappings.map(m => m.mysqlColumn);
      let rowsInserted = 0;
      let rowsUpdated = 0;
      let rowsDeleted = 0;

      // Process ข้อมูลใหม่
      if (transformedData.length > 0) {
        const safeColumns = columns.map(col => `\`${col}\``);
        const placeholders = columns.map(() => '?').join(', ');
        
        const insertSQL = `
          INSERT INTO \`${config.table_name}\` (${safeColumns.join(', ')}, sheet_row_index, row_hash)
          VALUES (${placeholders}, ?, ?)
        `;

        const updateSQL = `
          UPDATE \`${config.table_name}\` SET ${columns.map(col => `\`${col}\` = ?`).join(', ')}, row_hash = ?
          WHERE sheet_row_index = ?
        `;

        console.log('Insert SQL:', insertSQL);
        console.log('Update SQL:', updateSQL);

        const currentHashes = new Set();

        for (const [index, row] of transformedData.entries()) {
          const sheetRowIndex = index + 2; // +2 เพราะ header = row 1, data เริ่ม row 2
          
          // สร้าง values โดยใช้ข้อมูลที่แปลงแล้ว
          const values = columns.map(col => {
            const value = row[col];
            return value === undefined || value === '' ? null : value;
          });

          // สร้าง normalized values สำหรับ hash
          const normalizedValues = values.map(val => {
            if (val === null || val === undefined) return '';
            return String(val).trim();
          });

          // สร้าง hash จากข้อมูลแถวที่ normalized
          const rowHash = this.createRowHash(normalizedValues);
          currentHashes.add(rowHash);

          console.log(`Processing row ${sheetRowIndex}:`, values);
          console.log(`Row hash: ${rowHash}`);

          const existingRow = existingByRowIndex.get(sheetRowIndex);

          if (existingRow) {
            // แถวนี้มีอยู่แล้ว ตรวจสอบว่าข้อมูลเปลี่ยนแปลงหรือไม่
            if (existingRow.row_hash !== rowHash) {
              // ข้อมูลเปลี่ยน - update
              try {
                await connection.execute(updateSQL, [...values, rowHash, sheetRowIndex]);
                rowsUpdated++;
                console.log(`Updated row ${sheetRowIndex}`);
              } catch (updateError) {
                console.error(`Error updating row ${sheetRowIndex}:`, updateError);
                throw updateError;
              }
            } else {
              console.log(`Row ${sheetRowIndex} unchanged`);
            }
          } else {
            // แถวใหม่ - insert
            try {
              await connection.execute(insertSQL, [...values, sheetRowIndex, rowHash]);
              rowsInserted++;
              console.log(`Inserted new row ${sheetRowIndex}`);
            } catch (insertError) {
              console.error(`Error inserting row ${sheetRowIndex}:`, insertError);
              console.error('Values:', values);
              throw insertError;
            }
          }
        }

        // ลบแถวที่ไม่มีใน Google Sheets แล้ว (รวมแถวที่ sheet_row_index = null)
        const currentRowIndices = new Set(transformedData.map((_, index) => index + 2));
        
        // ลบแถวที่มี sheet_row_index แต่ไม่มีใน Google Sheets
        const rowsToDeleteWithIndex = existingData.filter(row => 
          row.sheet_row_index !== null && !currentRowIndices.has(row.sheet_row_index)
        );

        // ลบแถวที่ sheet_row_index = null (แถวที่เหลือจากการ sync ก่อนหน้า)
        const orphanedRows = existingData.filter(row => row.sheet_row_index === null);

        const allRowsToDelete = [...rowsToDeleteWithIndex, ...orphanedRows];

        if (allRowsToDelete.length > 0) {
          const deleteSQL = `DELETE FROM \`${config.table_name}\` WHERE id = ?`;
          for (const rowToDelete of allRowsToDelete) {
            await connection.execute(deleteSQL, [rowToDelete.id]);
            rowsDeleted++;
            const reason = rowToDelete.sheet_row_index === null ? 
              'orphaned row (null index)' : 
              `missing from sheet (was row ${rowToDelete.sheet_row_index})`;
            console.log(`Deleted row with id ${rowToDelete.id}: ${reason}`);
          }
        }
      }

      // อัพเดทสถานะการซิงค์
      await connection.execute(`
        UPDATE sync_configs 
        SET last_sync_at = CURRENT_TIMESTAMP, row_count = ?
        WHERE id = ?
      `, [transformedData.length, configId]);

      // บันทึก log
      const message = `Sync completed: ${rowsInserted} inserted, ${rowsUpdated} updated, ${rowsDeleted} deleted`;
      await connection.execute(`
        INSERT INTO sync_logs (config_id, status, message, rows_synced)
        VALUES (?, 'success', ?, ?)
      `, [configId, message, rowsInserted + rowsUpdated]);

      await connection.commit();

      return {
        success: true,
        message: message,
        rowsSynced: rowsInserted + rowsUpdated + rowsDeleted
      };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      
      console.error('Error syncing data:', error);
      
      // บันทึก error log
      try {
        await pool.execute(`
          INSERT INTO sync_logs (config_id, status, message, rows_synced)
          VALUES (?, 'error', ?, 0)
        `, [configId, (error as Error).message]);
      } catch (logError) {
        console.error('Error logging sync error:', logError);
      }

      return {
        success: false,
        message: (error as Error).message,
        rowsSynced: 0
      };
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // ทำความสะอาดแถวที่มี sheet_row_index หรือ row_hash เป็น null
  async cleanupOrphanedRows(configId: number): Promise<{ success: boolean; message: string; deletedRows: number }> {
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
      
      // เริ่ม transaction
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // นับและลบแถวที่เป็น null
      const [orphanedRows] = await connection.execute(`
        SELECT id, sheet_row_index, row_hash FROM \`${config.table_name}\` 
        WHERE sheet_row_index IS NULL OR row_hash IS NULL
      `);

      const orphanedCount = (orphanedRows as any[]).length;

      if (orphanedCount > 0) {
        await connection.execute(`
          DELETE FROM \`${config.table_name}\` 
          WHERE sheet_row_index IS NULL OR row_hash IS NULL
        `);

        console.log(`Cleaned up ${orphanedCount} orphaned rows from ${config.table_name}`);
        
        // บันทึก log
        await connection.execute(`
          INSERT INTO sync_logs (config_id, status, message, rows_synced)
          VALUES (?, 'cleanup', ?, ?)
        `, [configId, `Cleaned up ${orphanedCount} orphaned rows`, orphanedCount]);
      }

      await connection.commit();

      return {
        success: true,
        message: `Cleanup completed: ${orphanedCount} orphaned rows deleted`,
        deletedRows: orphanedCount
      };

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      
      console.error('Error cleaning up orphaned rows:', error);
      return {
        success: false,
        message: (error as Error).message,
        deletedRows: 0
      };
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // ทำความสะอาดแถวที่เป็น null ในทุกตารางที่ active
  async cleanupAllOrphanedRows(): Promise<{ success: boolean; message: string; totalDeleted: number }> {
    try {
      const configs = await this.getAllSyncConfigs();
      let totalDeleted = 0;
      const results = [];

      for (const config of configs) {
        const result = await this.cleanupOrphanedRows(config.id);
        totalDeleted += result.deletedRows;
        results.push({
          configId: config.id,
          configName: config.name,
          deletedRows: result.deletedRows,
          success: result.success
        });
      }

      return {
        success: true,
        message: `Cleanup completed for all configs: ${totalDeleted} total orphaned rows deleted`,
        totalDeleted
      };

    } catch (error) {
      console.error('Error cleaning up all orphaned rows:', error);
      return {
        success: false,
        message: (error as Error).message,
        totalDeleted: 0
      };
    }
  }
  async syncAllActiveConfigs(): Promise<void> {
    try {
      const configs = await this.getAllSyncConfigs();
      
      for (const config of configs) {
        console.log(`Syncing config: ${config.name}`);
        const result = await this.syncData(config.id);
        console.log(`Sync result:`, result);
      }
    } catch (error) {
      console.error('Error syncing all configs:', error);
    }
  }

  // ดึงสถิติการซิงค์
  async getSyncStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_configs,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_configs,
          SUM(row_count) as total_rows
        FROM sync_configs
      `);

      const [recentLogs] = await pool.execute(`
        SELECT sl.*, sc.name as config_name
        FROM sync_logs sl
        JOIN sync_configs sc ON sl.config_id = sc.id
        ORDER BY sl.created_at DESC
        LIMIT 10
      `);

      return {
        stats: (stats as any[])[0],
        recentLogs: recentLogs as any[]
      };
    } catch (error) {
      console.error('Error fetching sync stats:', error);
      return { stats: {}, recentLogs: [] };
    }
  }
}

export default new SyncService();