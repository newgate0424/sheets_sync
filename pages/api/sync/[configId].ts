// pages/api/sync/[configId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '@/lib/db';
import googleSheetsService from '@/lib/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { configId } = req.query;
  let connection: any = null;

  try {
    switch (req.method) {
      case 'POST':
        console.log(`=== SYNC CONFIG ${configId} ===`);
        
        const configIdNum = Number(configId);
        if (isNaN(configIdNum)) {
          return res.status(400).json({ error: 'Invalid config ID' });
        }

        // Check for smart mode option
        const { smartMode = false } = req.body;
        
        if (smartMode) {
          console.log('Using Smart Delta Sync mode...');
          const smartDeltaSyncService = await import('@/lib/smartDeltaSyncService');
          const result = await smartDeltaSyncService.default.smartSync(configIdNum);
          
          return res.status(200).json({
            success: result.success,
            message: result.message,
            rowsSynced: result.stats.newRows + result.stats.changedRows,
            smartStats: result.stats
          });
        }

        // Continue with standard sync...

        // 1. Get sync config
        console.log('1. Getting sync configuration...');
        const [configs] = await pool.execute(`
          SELECT * FROM sync_configs 
          WHERE id = ? AND is_active = 1
        `, [configIdNum]);
        
        if ((configs as any[]).length === 0) {
          return res.status(404).json({ 
            error: 'Sync configuration not found or inactive'
          });
        }
        
        const config = (configs as any[])[0];
        console.log('Using config:', config.name);
        
        // 2. Parse columns safely
        console.log('2. Parsing column mappings...');
        let columnMappings: any;
        try {
          const parsedColumns = JSON.parse(config.columns);
          columnMappings = Object.entries(parsedColumns).map(([googleCol, mysqlCol]) => ({
            googleColumn: googleCol,
            mysqlColumn: mysqlCol,
            dataType: 'VARCHAR(255)'
          }));
        } catch (parseError) {
          console.error('Column parsing failed:', parseError);
          return res.status(500).json({ 
            error: 'Invalid column mapping configuration'
          });
        }
        
        // 3. Get data from Google Sheets
        console.log('3. Fetching data from Google Sheets...');
        const sheetData = await googleSheetsService.getSheetData(config.sheet_url, config.sheet_name);
        console.log('Raw sheet data rows:', sheetData.length);
        
        if (sheetData.length === 0) {
          return res.status(200).json({ 
            success: true,
            message: 'No data found in Google Sheets',
            rowsSynced: 0
          });
        }
        
        // 4. Transform data
        console.log('4. Transforming data...');
        const headers = sheetData[0] || [];
        const dataRows = sheetData.slice(1);
        
        if (dataRows.length === 0) {
          return res.status(200).json({ 
            success: true,
            message: 'No data rows found (only headers)',
            rowsSynced: 0
          });
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
        
        console.log('Transformed rows:', transformedData.length);
        
        // 5. Check/Create table
        console.log('5. Checking table existence...');
        const [tableCheck] = await pool.execute(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() AND table_name = ?
        `, [config.table_name]);
        
        const tableExists = (tableCheck as any[])[0].count > 0;
        
        if (!tableExists) {
          console.log('Creating table...');
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
          console.log('Table created successfully');
        }
        
        // 6. Start transaction and sync data
        console.log('6. Starting data sync transaction...');
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
          
          let insertedRows = 0;
          for (const row of transformedData) {
            try {
              const values = insertColumns.map((col: string) => row[col]);
              await connection.execute(insertSQL, values);
              insertedRows++;
            } catch (insertError) {
              console.error('Insert error for row:', insertError);
            }
          }
          
          console.log('Inserted rows:', insertedRows);
        }
        
        // Update sync status
        await connection.execute(`
          UPDATE sync_configs 
          SET last_sync_at = CURRENT_TIMESTAMP, row_count = ?
          WHERE id = ?
        `, [transformedData.length, configIdNum]);
        
        // Log success
        await connection.execute(`
          INSERT INTO sync_logs (config_id, status, message, rows_synced)
          VALUES (?, 'success', ?, ?)
        `, [configIdNum, 'Sync completed successfully', transformedData.length]);
        
        await connection.commit();
        console.log('Sync completed successfully');
        
        return res.status(200).json({
          success: true,
          message: 'Data synchronized successfully',
          rowsSynced: transformedData.length
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    
    // Log error
    try {
      await pool.execute(`
        INSERT INTO sync_logs (config_id, status, message, rows_synced)
        VALUES (?, 'error', ?, 0)
      `, [Number(configId), (error as Error).message]);
    } catch (logError) {
      console.error('Error logging sync error:', logError);
    }
    
    return res.status(500).json({ 
      success: false,
      error: (error as Error).message,
      rowsSynced: 0
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
