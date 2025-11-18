const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:NewStrongPassword123!@127.0.0.1:5432/ads_data',
  ssl: false
});

const sql = `
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dataset_name, folder_name)
);

-- Create folder_tables table
CREATE TABLE IF NOT EXISTS folder_tables (
  id SERIAL PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dataset_name, folder_name, table_name)
);

-- Create sync_config table
CREATE TABLE IF NOT EXISTS sync_config (
  id SERIAL PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  sheet_url TEXT NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  last_sync TIMESTAMP NULL,
  last_checksum VARCHAR(32) NULL,
  skip_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dataset_name, table_name)
);

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  rows_affected INT DEFAULT 0,
  error_message TEXT,
  sync_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_table ON sync_logs(dataset_name, table_name);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, role) 
VALUES ('admin', '$2b$10$YourHashedPasswordHere', 'admin')
ON CONFLICT (username) DO NOTHING;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Connecting to PostgreSQL database...');
    console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    
    console.log('Running migrations...');
    
    // Split SQL into individual statements and execute each one
    const statements = sql.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await client.query(statement + ';');
      }
    }
    
    console.log('✓ Migration completed successfully!');
    console.log('✓ Tables created: users, folders, folder_tables, sync_config, sync_logs');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
