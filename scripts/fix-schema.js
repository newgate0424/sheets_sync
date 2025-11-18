const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:NewStrongPassword123!@127.0.0.1:5432/ads_data',
  ssl: false
});

async function fixSchema() {
  const client = await pool.connect();
  try {
    console.log('Fixing database schema...');
    
    // Make sheet_url nullable and add missing columns to sync_config
    await client.query(`
      ALTER TABLE sync_config 
      ALTER COLUMN sheet_url DROP NOT NULL
    `);
    
    await client.query(`
      ALTER TABLE sync_config 
      ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS spreadsheet_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sheet_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_checksum VARCHAR(64),
      ADD COLUMN IF NOT EXISTS skip_count INT DEFAULT 0
    `);
    console.log('✓ Fixed sync_config columns');
    
    // Update sync_logs table structure
    await client.query(`
      ALTER TABLE sync_logs 
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS duration_seconds INT,
      ADD COLUMN IF NOT EXISTS inserted INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS deleted INT DEFAULT 0
    `);
    console.log('✓ Fixed sync_logs columns');
    
    console.log('✓ Schema fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing schema:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema();
