require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306')
};

async function analyzeDuplicates() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    const tableName = 'aoy';
    
    console.log(`\n📋 Analyzing duplicates in: ${tableName}`);
    
    // Get rows with same sheet_row_index
    const [rows] = await connection.execute(`
      SELECT id, sheet_row_index, row_hash, name, date, mess, synced_at
      FROM \`${tableName}\`
      ORDER BY sheet_row_index, id
    `);
    
    console.log(`\n📄 All ${rows.length} rows with full data:`);
    console.log('   ID | Row | Hash     | Name        | Date        | Message     | Synced');
    console.log('   ---|-----|----------|-------------|-------------|-------------|-------');
    
    for (const row of rows) {
      const shortHash = row.row_hash ? row.row_hash.substring(0, 8) + '...' : 'null';
      const syncTime = row.synced_at ? row.synced_at.toTimeString().substring(0, 8) : 'null';
      const name = (row.name || 'NULL').substring(0, 11);
      const date = (row.date || 'NULL').substring(0, 11);  
      const mess = (row.mess || 'NULL').substring(0, 11);
      
      console.log(`   ${String(row.id).padEnd(3)} | ${String(row.sheet_row_index).padEnd(3)} | ${shortHash} | ${name.padEnd(11)} | ${date.padEnd(11)} | ${mess.padEnd(11)} | ${syncTime}`);
    }
    
    // Group by sheet_row_index and show differences
    const groups = {};
    rows.forEach(row => {
      if (!groups[row.sheet_row_index]) {
        groups[row.sheet_row_index] = [];
      }
      groups[row.sheet_row_index].push(row);
    });
    
    console.log(`\n🔍 Analyzing differences by sheet_row_index:`);
    for (const [rowIndex, groupRows] of Object.entries(groups)) {
      if (groupRows.length > 1) {
        console.log(`\n   Row ${rowIndex} (${groupRows.length} duplicates):`);
        for (let i = 0; i < groupRows.length; i++) {
          const row = groupRows[i];
          console.log(`     ${i + 1}. ID ${row.id}: "${row.name}" | "${row.date}" | "${row.mess}" (${row.row_hash?.substring(0, 8)}...)`);
        }
        
        // Check if data is actually identical
        const firstRow = groupRows[0];
        const allSame = groupRows.every(row => 
          row.name === firstRow.name && 
          row.date === firstRow.date && 
          row.mess === firstRow.mess
        );
        
        if (allSame) {
          console.log(`     ✅ All data is identical - safe to remove duplicates`);
        } else {
          console.log(`     ⚠️  Data differs - need careful handling`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing duplicates:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

analyzeDuplicates();
