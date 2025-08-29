// check-tracking-columns.js - ตรวจสอบ sheet_row_index และ row_hash
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function checkTrackingColumns() {
  let connection;
  try {
    // เชื่อมต่อ database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sheets_sync'
    });

    console.log('=== TRACKING COLUMNS ANALYSIS ===\n');

    // ดึงรายการ sync configs
    const [configs] = await connection.execute(`
      SELECT id, name, table_name, sheet_url, sheet_name, columns, row_count, last_sync_at
      FROM sync_configs 
      WHERE is_active = 1
    `);

    for (const config of configs) {
      console.log(`\n📋 Config: ${config.name}`);
      console.log(`📊 Table: ${config.table_name}`);
      console.log(`🔗 Sheet: ${config.sheet_name}`);

      // ตรวจสอบ columns ที่มีอยู่ใน table
      const [tableColumns] = await connection.execute(`
        SHOW COLUMNS FROM \`${config.table_name}\`
      `);
      
      const hasSheetRowIndex = tableColumns.some(col => col.Field === 'sheet_row_index');
      const hasRowHash = tableColumns.some(col => col.Field === 'row_hash');
      
      console.log(`🏗️  Table Structure:`);
      console.log(`   - sheet_row_index: ${hasSheetRowIndex ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`   - row_hash: ${hasRowHash ? '✅ EXISTS' : '❌ MISSING'}`);

      // นับแถวทั้งหมด
      const [totalRows] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
      `);
      const totalCount = totalRows[0].count;

      // นับแถวที่มี tracking data
      const [trackedRows] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
        WHERE sheet_row_index IS NOT NULL AND row_hash IS NOT NULL
      `);
      const trackedCount = trackedRows[0].count;

      // นับแถวที่ไม่มี tracking data
      const [untrackedRows] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
        WHERE sheet_row_index IS NULL OR row_hash IS NULL
      `);
      const untrackedCount = untrackedRows[0].count;

      console.log(`\n📊 Row Counts:`);
      console.log(`   - Total Rows: ${totalCount}`);
      console.log(`   - Tracked Rows: ${trackedCount} (with sheet_row_index & row_hash)`);
      console.log(`   - Untracked Rows: ${untrackedCount} (missing tracking data)`);

      if (hasSheetRowIndex && hasRowHash) {
        // แสดง sheet_row_index distribution
        const [indexDistribution] = await connection.execute(`
          SELECT sheet_row_index, COUNT(*) as count 
          FROM \`${config.table_name}\`
          WHERE sheet_row_index IS NOT NULL
          GROUP BY sheet_row_index
          ORDER BY sheet_row_index
        `);

        console.log(`\n🔢 Sheet Row Index Distribution:`);
        if (indexDistribution.length === 0) {
          console.log('   ❌ No sheet_row_index data found');
        } else {
          indexDistribution.forEach((row, i) => {
            const duplicateFlag = row.count > 1 ? '⚠️  DUPLICATE' : '✅';
            console.log(`   Row ${row.sheet_row_index}: ${row.count} records ${duplicateFlag}`);
            if (i >= 10) {
              console.log(`   ... and ${indexDistribution.length - 10} more rows`);
              return;
            }
          });
        }

        // ตรวจสอบ duplicates
        const [duplicates] = await connection.execute(`
          SELECT sheet_row_index, COUNT(*) as count 
          FROM \`${config.table_name}\`
          WHERE sheet_row_index IS NOT NULL
          GROUP BY sheet_row_index
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `);

        if (duplicates.length > 0) {
          console.log(`\n⚠️  DUPLICATE SHEET_ROW_INDEX FOUND:`);
          duplicates.forEach(dup => {
            console.log(`   Row ${dup.sheet_row_index}: ${dup.count} duplicates`);
          });
        }

        // แสดงตัวอย่างข้อมูลทั้งหมด
        const [sampleData] = await connection.execute(`
          SELECT id, sheet_row_index, row_hash, synced_at
          FROM \`${config.table_name}\`
          ORDER BY id
          LIMIT 15
        `);

        console.log(`\n📄 Sample Data (first 15 rows):`);
        console.log('   ID | sheet_row_index | row_hash | synced_at');
        console.log('   ---|-----------------|----------|----------');
        sampleData.forEach(row => {
          const hashShort = row.row_hash ? row.row_hash.substring(0, 8) + '...' : 'NULL';
          const syncTime = row.synced_at ? row.synced_at.toISOString().substring(11, 19) : 'NULL';
          console.log(`   ${row.id.toString().padStart(3)} | ${(row.sheet_row_index || 'NULL').toString().padStart(15)} | ${hashShort.padStart(10)} | ${syncTime}`);
        });
      }

      console.log('\n' + '='.repeat(80));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// เรียกใช้
checkTrackingColumns().catch(console.error);
