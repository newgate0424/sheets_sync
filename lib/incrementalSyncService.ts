import pool from './db';
import googleSheetsService from './googleSheetsService';
import crypto from 'crypto';

interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  columns: any;
  is_active: boolean;
  last_sync_at?: string;
  row_count: number;
}

interface SyncResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    insertedRows: number;
    updatedRows: number;
    deletedRows: number;
    unchangedRows: number;
  };
}

class IncrementalSyncService {
  
  // สร้าง hash สำหรับแถวข้อมูล เพื่อเปรียบเทียบการเปลี่ยนแปลง
  private createRowHash(row: any, columns: string[]): string {
    const values = columns.map(col => String(row[col] || '')).join('|');
    return crypto.createHash('md5').update(values).digest('hex');
  }

  // แปลงข้อมูล Google Sheets เป็นรูปแบบที่มี unique identifier
  private processSheetData(sheetData: any[][], columnMappings: any[]): any[] {
    if (sheetData.length === 0) return [];
    
    const headers = sheetData[0];
    const dataRows = sheetData.slice(1);
    
    return dataRows.map((row, index) => {
      const processedRow: any = {
        sheet_row_index: index + 2, // +2 เพราะ headers = row 1, data เริ่ม row 2
      };
      
      columnMappings.forEach((mapping) => {
        const headerIndex = headers.findIndex((header: string) => 
          header.toString().trim() === mapping.googleColumn.toString().trim()
        );
        
        let value = null;
        if (headerIndex !== -1 && headerIndex < row.length) {
          value = row[headerIndex];
          if (value !== undefined && value !== null && value !== '') {
            value = String(value).trim();
            if (value === '') value = null;
          } else {
            value = null;
          }
        }
        
        processedRow[mapping.mysqlColumn] = value;
      });
      
      // สร้าง hash สำหรับเปรียบเทียบ
      const dataColumns = columnMappings.map(m => m.mysqlColumn);
      processedRow.row_hash = this.createRowHash(processedRow, dataColumns);
      
      return processedRow;
    });
  }

  // ดึงข้อมูลปัจจุบันจากฐานข้อมูล พร้อม hash
  private async getCurrentTableData(tableName: string, columns: string[]): Promise<Map<number, any>> {
    try {
      const [rows] = await pool.execute(`
        SELECT *, sheet_row_index, row_hash FROM \`${tableName}\`
      `);
      
      const dataMap = new Map();
      (rows as any[]).forEach(row => {
        dataMap.set(row.sheet_row_index, row);
      });
      
      return dataMap;
    } catch (error) {
      console.log('Table might not exist or missing columns, returning empty map');
      return new Map();
    }
  }

  // สร้าง/อัปเดตโครงสร้างตาราง
  private async ensureTableStructure(tableName: string, columnMappings: any[]): Promise<void> {
    try {
      // ตรวจสอบว่าตารางมีอยู่แล้วหรือไม่
      const [existing] = await pool.execute(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `, [tableName]);

      const tableExists = (existing as any)[0].count > 0;

      if (!tableExists) {
        // สร้างตารางใหม่
        const columnDefs = columnMappings.map(col => 
          `\`${col.mysqlColumn}\` VARCHAR(255)`
        ).join(', ');

        const createTableSQL = `
          CREATE TABLE \`${tableName}\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ${columnDefs},
            sheet_row_index INT NOT NULL,
            row_hash VARCHAR(32),
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_sheet_row (sheet_row_index),
            KEY idx_row_hash (row_hash)
          )
        `;

        await pool.execute(createTableSQL);
        console.log(`Created table ${tableName} with incremental sync structure`);
      } else {
        // ตรวจสอบและเพิ่มคอลัมน์ที่จำเป็น
        const [columns] = await pool.execute(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS 
          WHERE table_schema = DATABASE() AND table_name = ?
        `, [tableName]);

        const existingColumns = (columns as any[]).map(col => col.COLUMN_NAME);
        
        if (!existingColumns.includes('sheet_row_index')) {
          await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN sheet_row_index INT`);
          await pool.execute(`ALTER TABLE \`${tableName}\` ADD UNIQUE KEY unique_sheet_row (sheet_row_index)`);
        }
        
        if (!existingColumns.includes('row_hash')) {
          await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN row_hash VARCHAR(32)`);
          await pool.execute(`ALTER TABLE \`${tableName}\` ADD KEY idx_row_hash (row_hash)`);
        }
        
        console.log(`Ensured table ${tableName} has incremental sync structure`);
      }
    } catch (error) {
      console.error('Error ensuring table structure:', error);
      throw error;
    }
  }

  // ทำการซิงค์แบบ incremental
  async incrementalSync(configId: number): Promise<SyncResult> {
    let connection: any = null;
    
    try {
      console.log(`=== INCREMENTAL SYNC CONFIG ${configId} ===`);
      
      // 1. ดึงการตั้งค่า
      const [configs] = await pool.execute(`
        SELECT * FROM sync_configs WHERE id = ? AND is_active = 1
      `, [configId]);
      
      if ((configs as any[]).length === 0) {
        throw new Error('Sync configuration not found or inactive');
      }
      
      const config = (configs as any[])[0];
      console.log(`Syncing: ${config.name}`);
      
      // 2. แปลง column mappings
      const columnMappings = Object.entries(JSON.parse(config.columns)).map(([googleCol, mysqlCol]) => ({
        googleColumn: googleCol,
        mysqlColumn: mysqlCol,
        dataType: 'VARCHAR(255)'
      }));
      
      // 3. ตรวจสอบโครงสร้างตาราง
      await this.ensureTableStructure(config.table_name, columnMappings);
      
      // 4. ดึงข้อมูลจาก Google Sheets
      console.log('Fetching data from Google Sheets...');
      const sheetData = await googleSheetsService.getSheetData(config.sheet_url, config.sheet_name);
      
      if (sheetData.length === 0) {
        return {
          success: true,
          message: 'No data in Google Sheets',
          stats: { totalRows: 0, insertedRows: 0, updatedRows: 0, deletedRows: 0, unchangedRows: 0 }
        };
      }
      
      // 5. ประมวลผลข้อมูลใหม่
      const newData = this.processSheetData(sheetData, columnMappings);
      console.log(`Processed ${newData.length} rows from Google Sheets`);
      
      // 6. ดึงข้อมูลปัจจุบันจากฐานข้อมูล
      const dataColumns: string[] = columnMappings.map((m: any) => m.mysqlColumn);
      const currentData = await this.getCurrentTableData(config.table_name, dataColumns);
      console.log(`Found ${currentData.size} existing rows in database`);
      
      // 7. เปรียบเทียบและหาการเปลี่ยนแปลง
      const stats = {
        totalRows: newData.length,
        insertedRows: 0,
        updatedRows: 0,
        deletedRows: 0,
        unchangedRows: 0
      };
      
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      // เตรียม SQL statements
      const insertColumns = ['sheet_row_index', 'row_hash', ...dataColumns];
      const insertPlaceholders = insertColumns.map(() => '?').join(', ');
      const insertSQL = `
        INSERT INTO \`${config.table_name}\` 
        (${insertColumns.map(col => `\`${col}\``).join(', ')})
        VALUES (${insertPlaceholders})
        ON DUPLICATE KEY UPDATE
        ${dataColumns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')},
        row_hash = VALUES(row_hash),
        synced_at = CURRENT_TIMESTAMP
      `;
      
      // 8. ประมวลผลแต่ละแถว
      for (const newRow of newData) {
        const existingRow = currentData.get(newRow.sheet_row_index);
        
        if (!existingRow) {
          // แถวใหม่ - INSERT
          const values = [
            newRow.sheet_row_index,
            newRow.row_hash,
            ...dataColumns.map(col => newRow[col])
          ];
          await connection.execute(insertSQL, values);
          stats.insertedRows++;
          console.log(`Inserted new row at sheet index ${newRow.sheet_row_index}`);
          
        } else if (existingRow.row_hash !== newRow.row_hash) {
          // แถวมีการเปลี่ยนแปลง - UPDATE
          const values = [
            newRow.sheet_row_index,
            newRow.row_hash,
            ...dataColumns.map(col => newRow[col])
          ];
          await connection.execute(insertSQL, values);
          stats.updatedRows++;
          console.log(`Updated row at sheet index ${newRow.sheet_row_index}`);
          
        } else {
          // แถวไม่เปลี่ยนแปลง
          stats.unchangedRows++;
        }
      }
      
      // 9. ลบแถวที่ไม่มีใน Google Sheets แล้ว
      const newRowIndexes = new Set(newData.map(row => row.sheet_row_index));
      for (const [existingIndex] of currentData) {
        if (!newRowIndexes.has(existingIndex)) {
          await connection.execute(`
            DELETE FROM \`${config.table_name}\` WHERE sheet_row_index = ?
          `, [existingIndex]);
          stats.deletedRows++;
          console.log(`Deleted row at sheet index ${existingIndex}`);
        }
      }
      
      // 10. อัปเดตสถิติการซิงค์
      await connection.execute(`
        UPDATE sync_configs 
        SET last_sync_at = CURRENT_TIMESTAMP, row_count = ?
        WHERE id = ?
      `, [stats.totalRows, configId]);
      
      // 11. บันทึก log
      const message = `Incremental sync: +${stats.insertedRows} ~${stats.updatedRows} -${stats.deletedRows} =${stats.unchangedRows}`;
      await connection.execute(`
        INSERT INTO sync_logs (config_id, status, message, rows_synced)
        VALUES (?, 'success', ?, ?)
      `, [configId, message, stats.insertedRows + stats.updatedRows]);
      
      await connection.commit();
      
      console.log('Incremental sync completed:', stats);
      
      return {
        success: true,
        message,
        stats
      };
      
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      
      console.error('Incremental sync error:', error);
      
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
        stats: { totalRows: 0, insertedRows: 0, updatedRows: 0, deletedRows: 0, unchangedRows: 0 }
      };
      
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // ซิงค์ทุก active configs แบบ incremental
  async syncAllIncremental(): Promise<any[]> {
    try {
      const [configs] = await pool.execute(`
        SELECT id, name FROM sync_configs WHERE is_active = 1
      `);
      
      const results = [];
      
      for (const config of (configs as any[])) {
        console.log(`\n=== Incremental sync for ${config.name} ===`);
        const result = await this.incrementalSync(config.id);
        results.push({
          configId: config.id,
          configName: config.name,
          ...result
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error in syncAllIncremental:', error);
      throw error;
    }
  }
}

export default new IncrementalSyncService();
