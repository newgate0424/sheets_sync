import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const connection = await pool.getConnection();
    
    // Get all databases
    const [databases]: any = await connection.query('SHOW DATABASES');
    
    const datasets = await Promise.all(
      databases
        .filter((db: any) => db.Database === process.env.DB_NAME || db.Database === 'bigquery' || db.Database === 'sacom_bigquery')
        .map(async (db: any) => {
          const dbName = db.Database;
          
          // Get tables for this database
          const [tables]: any = await connection.query(`SHOW TABLE STATUS FROM \`${dbName}\``);
          
          // กรองตารางระบบออก (folders, folder_tables, sync_config, sync_logs, users)
          const filteredTables = tables.filter((table: any) => 
            !['folders', 'folder_tables', 'sync_config', 'sync_logs', 'users'].includes(table.Name)
          );
          
          return {
            name: dbName,
            tables: filteredTables.map((table: any) => ({
              name: table.Name,
              rows: table.Rows || 0,
              size: formatBytes(table.Data_length + table.Index_length),
            })),
            expanded: false,
          };
        })
    );
    
    connection.release();
    
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
