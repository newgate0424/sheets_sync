// clean-null-rows.js - ลบแถวที่มี NULL values ในคอลัมน์ข้อมูล
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function cleanNullRows() {
  let connection;
  try {
    console.log('🔍 Checking for NULL rows with tracking data...\n');

    // เชื่อมต่อ database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sheets_sync'
    });

    // ดึงรายการ sync configs
    const [configs] = await connection.execute(`
      SELECT id, name, table_name, sheet_url, sheet_name, columns
      FROM sync_configs 
      WHERE is_active = 1
    `);

    for (const config of configs) {
      console.log(`📋 Checking Table: ${config.table_name}`);
      console.log(`🔗 Config: ${config.name}`);

      // ตรวจสอบ columns ที่มีอยู่ใน table
      const [tableColumns] = await connection.execute(`
        SHOW COLUMNS FROM \`${config.table_name}\`
      `);

      // แยก data columns จาก tracking columns
      const dataColumns = tableColumns
        .filter(col => !['id', 'sheet_row_index', 'row_hash', 'synced_at'].includes(col.Field))
        .map(col => col.Field);

      console.log(`📊 Data columns: ${dataColumns.join(', ')}`);

      // หาแถวที่มี NULL ในทุก data columns แต่มี tracking data
      const nullConditions = dataColumns.map(col => `\`${col}\` IS NULL`).join(' AND ');
      
      const [nullRows] = await connection.execute(`
        SELECT id, sheet_row_index, row_hash, ${dataColumns.map(col => `\`${col}\``).join(', ')}
        FROM \`${config.table_name}\`
        WHERE (${nullConditions}) AND (sheet_row_index IS NOT NULL OR row_hash IS NOT NULL)
      `);

      console.log(`🔍 Found ${nullRows.length} rows with NULL data but tracking columns`);

      if (nullRows.length > 0) {
        console.log('\n⚠️  NULL rows found:');
        nullRows.forEach(row => {
          console.log(`   ID: ${row.id}, sheet_row_index: ${row.sheet_row_index}, row_hash: ${row.row_hash ? row.row_hash.substring(0, 8) + '...' : 'NULL'}`);
        });

        console.log(`\n🗑️  Deleting ${nullRows.length} NULL rows...`);
        
        // ลบแถวที่มี NULL ในทุก data columns
        const deleteResult = await connection.execute(`
          DELETE FROM \`${config.table_name}\`
          WHERE (${nullConditions}) AND (sheet_row_index IS NOT NULL OR row_hash IS NOT NULL)
        `);

        console.log(`✅ Deleted ${deleteResult[0].affectedRows} NULL rows`);

        // อัพเดทจำนวนแถวใน sync config
        const [remainingCount] = await connection.execute(`
          SELECT COUNT(*) as count FROM \`${config.table_name}\`
        `);
        const newCount = remainingCount[0].count;

        await connection.execute(`
          UPDATE sync_configs 
          SET row_count = ?, last_sync_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newCount, config.id]);

        console.log(`📊 Updated row count to ${newCount}`);

        // บันทึก log
        await connection.execute(`
          INSERT INTO sync_logs (config_id, status, message, rows_synced)
          VALUES (?, 'success', ?, ?)
        `, [config.id, `Cleaned ${deleteResult[0].affectedRows} NULL rows`, deleteResult[0].affectedRows]);

      } else {
        console.log('✅ No NULL rows found');
      }

      // ตรวจสอบผลลัพธ์สุดท้าย
      const [finalCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
      `);
      
      console.log(`\n📊 Final row count: ${finalCount[0].count}`);
      
      // แสดงตัวอย่างข้อมูลที่เหลือ
      const [finalData] = await connection.execute(`
        SELECT id, sheet_row_index, row_hash, ${dataColumns.map(col => `\`${col}\``).join(', ')}
        FROM \`${config.table_name}\`
        ORDER BY sheet_row_index
      `);

      console.log('\n📄 Remaining data:');
      console.log('   ID | sheet_row_index | Data columns');
      console.log('   ---|-----------------|-------------');
      finalData.forEach(row => {
        const dataValues = dataColumns.map(col => row[col] ? 'DATA' : 'NULL').join(',');
        console.log(`   ${row.id.toString().padStart(3)} | ${(row.sheet_row_index || 'NULL').toString().padStart(15)} | ${dataValues}`);
      });

      console.log('\n' + '='.repeat(80));
    }

    console.log('\n🎉 NULL row cleanup completed!');

  } catch (error) {
    console.error('❌ Error in cleanup:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// เรียกใช้
cleanNullRows().catch(console.error);
