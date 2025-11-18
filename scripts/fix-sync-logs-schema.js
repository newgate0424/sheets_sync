const mysql = require('mysql2/promise');

async function fixSyncLogsSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '147.50.228.21',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'adsthcom_connect',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'adsthcom_connect'
  });

  try {
    console.log('Fixing sync_logs table schema...');

    // 1. เช็คว่าตารางมีอยู่ไหม
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'sync_logs'
    `);

    if (tables.length === 0) {
      console.log('sync_logs table does not exist. Creating...');
      await connection.query(`
        CREATE TABLE sync_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          status VARCHAR(20) NOT NULL,
          table_name VARCHAR(255) NOT NULL,
          folder_name VARCHAR(255),
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          sync_duration INT DEFAULT 0,
          rows_inserted INT DEFAULT 0,
          rows_updated INT DEFAULT 0,
          rows_deleted INT DEFAULT 0,
          rows_synced INT DEFAULT 0,
          error_message TEXT,
          INDEX idx_table_name (table_name),
          INDEX idx_status (status),
          INDEX idx_started_at (started_at)
        )
      `);
      console.log('✓ sync_logs table created');
    } else {
      // 2. เพิ่ม columns ที่ขาดหาย
      console.log('Checking and adding missing columns...');

      const columnsToAdd = [
        { name: 'folder_name', definition: 'VARCHAR(255) AFTER table_name' },
        { name: 'started_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER folder_name' },
        { name: 'completed_at', definition: 'TIMESTAMP NULL AFTER started_at' },
        { name: 'sync_duration', definition: 'INT DEFAULT 0 AFTER completed_at' },
        { name: 'rows_inserted', definition: 'INT DEFAULT 0 AFTER sync_duration' },
        { name: 'rows_updated', definition: 'INT DEFAULT 0 AFTER rows_inserted' },
        { name: 'rows_deleted', definition: 'INT DEFAULT 0 AFTER rows_updated' },
        { name: 'rows_synced', definition: 'INT DEFAULT 0 AFTER rows_deleted' }
      ];

      for (const col of columnsToAdd) {
        try {
          // เช็คว่า column มีอยู่แล้วไหม
          const [columns] = await connection.query(`
            SHOW COLUMNS FROM sync_logs LIKE '${col.name}'
          `);

          if (columns.length === 0) {
            await connection.query(`
              ALTER TABLE sync_logs ADD COLUMN ${col.name} ${col.definition}
            `);
            console.log(`✓ Added column: ${col.name}`);
          } else {
            console.log(`- Column already exists: ${col.name}`);
          }
        } catch (error) {
          console.log(`⚠ Error adding ${col.name}:`, error.message);
        }
      }

      // 3. ลบ columns เก่าที่ไม่ใช้แล้ว (ถ้ามี)
      const columnsToRemove = ['dataset_name', 'rows_affected', 'sync_type', 'created_at', 'synced_at', 'inserted', 'updated', 'deleted', 'duration_seconds'];

      for (const colName of columnsToRemove) {
        try {
          const [columns] = await connection.query(`
            SHOW COLUMNS FROM sync_logs LIKE '${colName}'
          `);

          if (columns.length > 0) {
            await connection.query(`
              ALTER TABLE sync_logs DROP COLUMN ${colName}
            `);
            console.log(`✓ Removed old column: ${colName}`);
          }
        } catch (error) {
          console.log(`⚠ Error removing ${colName}:`, error.message);
        }
      }
    }

    // 4. แสดง schema ปัจจุบัน
    console.log('\nCurrent sync_logs schema:');
    const [columns] = await connection.query('DESCRIBE sync_logs');
    console.table(columns);

    console.log('\n✅ Schema fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

fixSyncLogsSchema();
