import { NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';
import { getMongoDb } from '@/lib/mongoDb';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = await ensureDbInitialized();
    
    // Get dbType from MongoDB settings
    const mongoDb = await getMongoDb();
    const settings = await mongoDb.collection('settings').findOne({ key: 'database_connection' });
    const dbType = settings?.dbType || 'mysql';
    
    // Get current database name
    let databaseName = 'database';
    try {
      if (dbType === 'mysql') {
        const dbNameResult = await pool.query('SELECT DATABASE() as db_name');
        databaseName = dbNameResult.rows[0]?.db_name || 'database';
      } else {
        const dbNameResult = await pool.query('SELECT current_database() as db_name');
        databaseName = dbNameResult.rows[0]?.db_name || 'database';
      }
    } catch (err) {
      console.error('Error getting database name:', err);
    }
    
    // Get all tables from current database
    let tablesQuery: string;
    if (dbType === 'mysql') {
      tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      `;
    } else {
      tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `;
    }
    
    const result = await pool.query(tablesQuery);
    const tables = result.rows;
    
    // กรองตารางระบบออก (folders, folder_tables, sync_config, sync_logs, users)
    const filteredTables = tables.filter((table: any) => 
      !['folders', 'folder_tables', 'sync_config', 'sync_logs', 'users'].includes(table.table_name)
    );
    
    // Fetch row counts and sizes for all tables in parallel
    const tableInfoPromises = filteredTables.map(async (table: any) => {
      try {
        const tableName = table.table_name;
        
        // Get row count
        const countQuery = dbType === 'mysql' 
          ? `SELECT COUNT(*) as count FROM \`${tableName}\``
          : `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countResult = await pool.query(countQuery);
        const rowCount = parseInt(countResult.rows[0].count);
        
        // Get table size
        let tableSize = 0;
        if (dbType === 'mysql') {
          const sizeResult = await pool.query(`
            SELECT 
              data_length + index_length as size
            FROM information_schema.TABLES
            WHERE table_schema = DATABASE()
            AND table_name = ?
          `, [tableName]);
          tableSize = parseInt(sizeResult.rows[0]?.size || 0);
        } else {
          const sizeResult = await pool.query(`
            SELECT pg_total_relation_size($1) as size
          `, [tableName]);
          tableSize = parseInt(sizeResult.rows[0].size);
        }
        
        return {
          name: tableName,
          rows: rowCount,
          size: formatBytes(tableSize),
        };
      } catch (err) {
        console.error(`Error fetching info for table ${table.table_name}:`, err);
        return {
          name: table.table_name,
          rows: 0,
          size: '0 B',
        };
      }
    });
    
    const tablesWithInfo = await Promise.all(tableInfoPromises);
    
    const datasets = [{
      name: databaseName,
      tables: tablesWithInfo,
      expanded: false,
    }];
    
    return NextResponse.json(datasets);
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
