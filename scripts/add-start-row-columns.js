/**
 * Migration script: เพิ่ม columns start_row และ has_header ในตาราง sync_config
 * เพื่อรองรับการกำหนด startRow และ hasHeader ตอน sync Google Sheets
 * 
 * Run: node scripts/add-start-row-columns.js
 */

const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

async function getDbConnection() {
  // ใช้ MongoDB URI จาก environment หรือ default
  const mongoUri = process.env.DATABASE_USER_URL || process.env.MONGODB_URI || 'mongodb+srv://sanewgate:newgate0424@data-ads.jxyonoc.mongodb.net/sheets_sync?retryWrites=true&w=majority&authSource=admin';
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  
  // Extract database name from URI
  const dbName = mongoUri.split('/')[3]?.split('?')[0] || 'sheets_sync';
  const db = mongoClient.db(dbName);
  const settings = await db.collection('settings').findOne({ key: 'database_connection' });
  
  if (!settings) {
    throw new Error('Database connection settings not found');
  }

  const { dbType, host, port, database, username, password } = settings;

  if (dbType === 'postgresql') {
    const pool = new Pool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
    });
    return { pool, dbType, mongoClient };
  } else if (dbType === 'mysql') {
    const pool = await mysql.createPool({
      host,
      port: port || 3306,
      database,
      user: username,
      password,
      waitForConnections: true,
      connectionLimit: 10,
    });
    return { pool, dbType, mongoClient };
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }
}

async function main() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await getDbConnection();
    const { pool, dbType, mongoClient } = connection;

    console.log(`📊 Database type: ${dbType}`);

    if (dbType === 'mysql') {
      console.log('➕ Adding start_row and has_header columns to sync_config (MySQL)...');
      
      // Check if columns already exist
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'sync_config'
        AND COLUMN_NAME IN ('start_row', 'has_header')
      `);
      
      const existingColumns = columns.map((c) => c.COLUMN_NAME);
      
      if (!existingColumns.includes('start_row')) {
        await pool.query(`
          ALTER TABLE sync_config 
          ADD COLUMN start_row INT DEFAULT 1 COMMENT 'แถวแรกที่เริ่มอ่านข้อมูล (1-indexed)'
        `);
        console.log('✅ Added start_row column');
      } else {
        console.log('⚠️  start_row column already exists');
      }
      
      if (!existingColumns.includes('has_header')) {
        await pool.query(`
          ALTER TABLE sync_config 
          ADD COLUMN has_header TINYINT(1) DEFAULT 1 COMMENT 'แถวแรกเป็น header หรือไม่ (1=ใช่, 0=ไม่)'
        `);
        console.log('✅ Added has_header column');
      } else {
        console.log('⚠️  has_header column already exists');
      }
      
      await pool.end();
      
    } else if (dbType === 'postgresql') {
      console.log('➕ Adding start_row and has_header columns to sync_config (PostgreSQL)...');
      
      // Check if columns already exist
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sync_config'
        AND column_name IN ('start_row', 'has_header')
      `);
      
      const existingColumns = result.rows.map((r) => r.column_name);
      
      if (!existingColumns.includes('start_row')) {
        await pool.query(`
          ALTER TABLE sync_config 
          ADD COLUMN IF NOT EXISTS start_row INTEGER DEFAULT 1
        `);
        await pool.query(`
          COMMENT ON COLUMN sync_config.start_row IS 'แถวแรกที่เริ่มอ่านข้อมูล (1-indexed)'
        `);
        console.log('✅ Added start_row column');
      } else {
        console.log('⚠️  start_row column already exists');
      }
      
      if (!existingColumns.includes('has_header')) {
        await pool.query(`
          ALTER TABLE sync_config 
          ADD COLUMN IF NOT EXISTS has_header BOOLEAN DEFAULT TRUE
        `);
        await pool.query(`
          COMMENT ON COLUMN sync_config.has_header IS 'แถวแรกเป็น header หรือไม่'
        `);
        console.log('✅ Added has_header column');
      } else {
        console.log('⚠️  has_header column already exists');
      }
      
      await pool.end();
    }

    await mongoClient.close();
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
