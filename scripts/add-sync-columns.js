const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function addColumns() {
  let connection;
  try {
    // Read .env file
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    let dbUrl = '';
    
    for (const line of envLines) {
      if (line.startsWith('DATABASE_URL=')) {
        dbUrl = line.split('=')[1].replace(/"/g, '').trim();
        break;
      }
    }

    if (!dbUrl) {
      throw new Error('DATABASE_URL not found in .env');
    }

    // Parse DATABASE_URL
    const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    const [, user, password, host, port, database] = match;

    connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database
    });

    console.log('Connected to MySQL');

    // Check if columns already exist
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sync_logs'
    `, [database]);

    const columnNames = columns.map(c => c.COLUMN_NAME);
    console.log('Existing columns:', columnNames);

    if (!columnNames.includes('rows_inserted')) {
      console.log('Adding rows_inserted column...');
      await connection.query('ALTER TABLE sync_logs ADD COLUMN rows_inserted INT DEFAULT 0');
      console.log('✓ rows_inserted added');
    } else {
      console.log('✓ rows_inserted already exists');
    }

    if (!columnNames.includes('rows_updated')) {
      console.log('Adding rows_updated column...');
      await connection.query('ALTER TABLE sync_logs ADD COLUMN rows_updated INT DEFAULT 0');
      console.log('✓ rows_updated added');
    } else {
      console.log('✓ rows_updated already exists');
    }

    if (!columnNames.includes('rows_deleted')) {
      console.log('Adding rows_deleted column...');
      await connection.query('ALTER TABLE sync_logs ADD COLUMN rows_deleted INT DEFAULT 0');
      console.log('✓ rows_deleted added');
    } else {
      console.log('✓ rows_deleted already exists');
    }

    console.log('\nAll columns added successfully!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addColumns();
