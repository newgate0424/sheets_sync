require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306')
};

async function removeDuplicates() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Get sync configs
    const [configs] = await connection.execute(
      'SELECT id, table_name, name FROM sync_configs WHERE is_active = 1'
    );
    
    for (const config of configs) {
      const { table_name, name } = config;
      
      console.log(`\n📋 Processing Table: ${table_name}`);
      console.log(`🔗 Config: ${name}`);
      
      // Check if table exists and has tracking columns
      const [tableCheck] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.columns 
        WHERE table_schema = ? AND table_name = ? AND column_name = 'sheet_row_index'
      `, [process.env.DB_NAME, table_name]);
      
      if (tableCheck[0].count === 0) {
        console.log(`⏭️ Skipping ${table_name} - no tracking columns`);
        continue;
      }
      
      // Get current row count
      const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table_name}\``);
      const beforeCount = countResult[0].count;
      console.log(`📊 Before cleanup: ${beforeCount} rows`);
      
      // Find duplicates by sheet_row_index and row_hash
      const [duplicates] = await connection.execute(`
        SELECT sheet_row_index, row_hash, COUNT(*) as count, MIN(id) as keep_id
        FROM \`${table_name}\`
        WHERE sheet_row_index IS NOT NULL AND row_hash IS NOT NULL
        GROUP BY sheet_row_index, row_hash
        HAVING COUNT(*) > 1
        ORDER BY sheet_row_index
      `);
      
      if (duplicates.length === 0) {
        console.log(`✅ No duplicates found in ${table_name}`);
        continue;
      }
      
      console.log(`🔍 Found ${duplicates.length} groups of duplicates:`);
      for (const dup of duplicates) {
        console.log(`   Row ${dup.sheet_row_index}: ${dup.count} records (keeping ID ${dup.keep_id})`);
      }
      
      // Remove duplicates, keeping the row with the lowest ID for each group
      let totalRemoved = 0;
      
      for (const dup of duplicates) {
        const [deleteResult] = await connection.execute(`
          DELETE FROM \`${table_name}\`
          WHERE sheet_row_index = ? AND row_hash = ? AND id != ?
        `, [dup.sheet_row_index, dup.row_hash, dup.keep_id]);
        
        console.log(`   🗑️ Removed ${deleteResult.affectedRows} duplicates for row ${dup.sheet_row_index}`);
        totalRemoved += deleteResult.affectedRows;
      }
      
      // Get final row count
      const [finalCountResult] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table_name}\``);
      const afterCount = finalCountResult[0].count;
      
      console.log(`📊 After cleanup: ${afterCount} rows`);
      console.log(`🧹 Total removed: ${totalRemoved} duplicate rows`);
      
      // Show remaining data summary
      const [remaining] = await connection.execute(`
        SELECT sheet_row_index, COUNT(*) as count
        FROM \`${table_name}\`
        WHERE sheet_row_index IS NOT NULL
        GROUP BY sheet_row_index
        ORDER BY sheet_row_index
      `);
      
      console.log(`📄 Remaining row distribution:`);
      for (const row of remaining) {
        console.log(`   Row ${row.sheet_row_index}: ${row.count} record${row.count > 1 ? 's' : ''}`);
      }
    }
    
    console.log('\n🎉 Duplicate removal completed!');
    
  } catch (error) {
    console.error('❌ Error removing duplicates:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

removeDuplicates();
