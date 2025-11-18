const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
