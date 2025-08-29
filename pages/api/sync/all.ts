// pages/api/sync/all.ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '@/lib/db';
import googleSheetsService from '@/lib/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        console.log('=== SYNC ALL ACTIVE CONFIGS ===');
        
        // Get all active configs
        const [configs] = await pool.execute(`
          SELECT * FROM sync_configs 
          WHERE is_active = 1
          ORDER BY id
        `);
        
        const activeConfigs = configs as any[];
        console.log(`Found ${activeConfigs.length} active configurations`);
        
        if (activeConfigs.length === 0) {
          return res.status(200).json({ 
            message: 'No active configurations found',
            totalSynced: 0 
          });
        }
        
        let totalSynced = 0;
        const results = [];
        
        // Sync each config
        for (const config of activeConfigs) {
          console.log(`Syncing config: ${config.name}`);
          
          try {
            const result = await syncSingleConfig(config);
            totalSynced += result.rowsSynced || 0;
            results.push({
              configId: config.id,
              configName: config.name,
              success: result.success,
              rowsSynced: result.rowsSynced || 0,
              message: result.message
            });
          } catch (error) {
            console.error(`Error syncing config ${config.id}:`, error);
            results.push({
              configId: config.id,
              configName: config.name,
              success: false,
              error: (error as Error).message
            });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        console.log(`Sync all completed: ${successCount} success, ${failCount} failed, ${totalSynced} total rows`);
        
        return res.status(200).json({ 
          message: `Synced ${successCount} configurations successfully`,
          totalConfigs: activeConfigs.length,
          successCount,
          failCount,
          totalRowsSynced: totalSynced,
          results
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync all API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

// Helper function to sync a single config
async function syncSingleConfig(config: any): Promise<{ success: boolean; message: string; rowsSynced: number }> {
  let connection: any = null;
  
  try {
    console.log(`Starting sync for config: ${config.name}`);
    
    // Parse columns
    let columnMappings: any;
    try {
      const parsedColumns = JSON.parse(config.columns);
      columnMappings = Object.entries(parsedColumns).map(([googleCol, mysqlCol]) => ({
        googleColumn: googleCol,
        mysqlColumn: mysqlCol,
        dataType: 'VARCHAR(255)'
      }));
    } catch (parseError) {
      throw new Error('Invalid column mapping configuration');
    }
    
    // Get data from Google Sheets
    const sheetData = await googleSheetsService.getSheetData(config.sheet_url, config.sheet_name);
    
    if (sheetData.length === 0) {
      return { success: true, message: 'No data found in Google Sheets', rowsSynced: 0 };
    }
    
    const headers = sheetData[0] || [];
    const dataRows = sheetData.slice(1);
    
    if (dataRows.length === 0) {
      return { success: true, message: 'No data rows found (only headers)', rowsSynced: 0 };
    }
    
    const transformedData = dataRows.map((row) => {
      const transformedRow: any = {};
      
      columnMappings.forEach((mapping: any) => {
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
        
        transformedRow[mapping.mysqlColumn] = value;
      });
      
      return transformedRow;
    });
    
    // Check/Create table
    const [tableCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = ?
    `, [config.table_name]);
    
    const tableExists = (tableCheck as any[])[0].count > 0;
    
    if (!tableExists) {
      const columnDefs = columnMappings.map((col: any) => 
        `\`${col.mysqlColumn}\` ${col.dataType}`
      ).join(', ');
      
      const createSQL = `
        CREATE TABLE \`${config.table_name}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ${columnDefs},
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `;
      
      await pool.execute(createSQL);
    }
    
    // Start transaction and sync data
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Clear existing data
    await connection.execute(`DELETE FROM \`${config.table_name}\``);
    
    // Insert new data
    if (transformedData.length > 0) {
      const insertColumns = columnMappings.map((col: any) => col.mysqlColumn);
      const columnNames = insertColumns.map((col: string) => `\`${col}\``).join(', ');
      const placeholders = insertColumns.map(() => '?').join(', ');
      
      const insertSQL = `INSERT INTO \`${config.table_name}\` (${columnNames}) VALUES (${placeholders})`;
      
      for (const row of transformedData) {
        const values = insertColumns.map((col: string) => row[col]);
        await connection.execute(insertSQL, values);
      }
    }
    
    // Update sync status
    await connection.execute(`
      UPDATE sync_configs 
      SET last_sync_at = CURRENT_TIMESTAMP, row_count = ?
      WHERE id = ?
    `, [transformedData.length, config.id]);
    
    // Log success
    await connection.execute(`
      INSERT INTO sync_logs (config_id, status, message, rows_synced)
      VALUES (?, 'success', ?, ?)
    `, [config.id, 'Sync completed successfully', transformedData.length]);
    
    await connection.commit();
    
    return {
      success: true,
      message: 'Data synchronized successfully',
      rowsSynced: transformedData.length
    };
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    // Log error
    try {
      await pool.execute(`
        INSERT INTO sync_logs (config_id, status, message, rows_synced)
        VALUES (?, 'error', ?, 0)
      `, [config.id, (error as Error).message]);
    } catch (logError) {
      console.error('Error logging sync error:', logError);
    }
    
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}