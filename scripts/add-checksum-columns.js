// Script สำหรับเพิ่มคอลัมน์ checksum ใน sync_config table (รองรับทั้ง MySQL และ PostgreSQL)
// รันด้วย: node scripts/add-checksum-columns.js

const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sanewgate:newgate0424@data-ads.jxyonoc.mongodb.net/sheets_sync?retryWrites=true&w=majority&authSource=admin';
const MONGODB_DB = process.env.MONGODB_DB || 'sheets_sync';

async function getConnectionString() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    const settings = await db.collection('settings').findOne({ key: 'database_connection' });
    return settings?.value || null;
  } finally {
    await client.close();
  }
}

async function addChecksumColumns() {
  let connection;
  
  try {
    console.log('Getting database connection from MongoDB...');
    const connectionString = await getConnectionString();
    
    if (!connectionString) {
      throw new Error('No database connection string found in MongoDB settings');
    }
    
    const isMySQL = connectionString.startsWith('mysql://');
    
    if (isMySQL) {
      console.log('Connecting to MySQL...');
      const url = new URL(connectionString);
      connection = await mysql.createConnection({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1)
      });
      
      console.log('Adding checksum columns to sync_config (MySQL)...');
      
      // เช็คว่ามีคอลัมน์อยู่แล้วหรือไม่
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sync_config'
      `, [url.pathname.slice(1)]);
      
      const existingColumns = columns.map(c => c.COLUMN_NAME);
      
      if (!existingColumns.includes('last_checksum')) {
        await connection.query(`
          ALTER TABLE sync_config 
          ADD COLUMN last_checksum VARCHAR(32)
        `);
        console.log('✓ Added last_checksum column');
      } else {
        console.log('ℹ last_checksum column already exists');
      }
      
      if (!existingColumns.includes('last_row_count')) {
        await connection.query(`
          ALTER TABLE sync_config 
          ADD COLUMN last_row_count INT DEFAULT 0
        `);
        console.log('✓ Added last_row_count column');
      } else {
        console.log('ℹ last_row_count column already exists');
      }
      
      console.log('✓ Checksum columns ready');
      
      await connection.end();
    } else {
      console.log('Connecting to PostgreSQL...');
      connection = new Pool({ connectionString });
      
      console.log('Adding checksum columns to sync_config (PostgreSQL)...');
      
      await connection.query(`
        ALTER TABLE sync_config 
        ADD COLUMN IF NOT EXISTS last_checksum VARCHAR(32)
      `);
      
      await connection.query(`
        ALTER TABLE sync_config 
        ADD COLUMN IF NOT EXISTS last_row_count INTEGER DEFAULT 0
      `);
      
      console.log('✓ Checksum columns added successfully');
      
      await connection.end();
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addChecksumColumns();
