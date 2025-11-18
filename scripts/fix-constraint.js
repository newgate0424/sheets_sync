const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:NewStrongPassword123!@127.0.0.1:5432/ads_data',
  ssl: false
});

async function fixConstraint() {
  const client = await pool.connect();
  try {
    console.log('Fixing sync_logs status constraint...');
    
    await client.query('ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS sync_logs_status_check');
    await client.query(`
      ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_status_check 
      CHECK (status IN ('running', 'success', 'error', 'skipped', 'failed'))
    `);
    
    console.log('✓ Fixed sync_logs status constraint');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraint();
