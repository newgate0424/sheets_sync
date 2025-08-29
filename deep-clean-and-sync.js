// deep-clean-and-sync.js - ลบข้อมูลซ้ำทั้งหมดและทำ Full Sync ใหม่
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const { google } = require('googleapis');

async function deepCleanAndSync() {
  let connection;
  try {
    console.log('🧹 Starting Deep Clean and Full Sync...\n');

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
      console.log(`\n🧹 Deep Cleaning Table: ${config.table_name}`);
      console.log(`📋 Config: ${config.name}`);
      
      // นับข้อมูลก่อนลบ
      const [beforeCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
      `);
      console.log(`📊 Rows before cleaning: ${beforeCount[0].count}`);

      // ลบข้อมูลทั้งหมดในตาราง
      console.log('🗑️  Deleting ALL existing data...');
      await connection.execute(`DELETE FROM \`${config.table_name}\``);
      console.log('✅ All data deleted');

      // รีเซ็ต AUTO_INCREMENT
      await connection.execute(`ALTER TABLE \`${config.table_name}\` AUTO_INCREMENT = 1`);
      console.log('🔢 AUTO_INCREMENT reset to 1');

      // ดึงข้อมูลจาก Google Sheets
      console.log('📄 Fetching fresh data from Google Sheets...');
      
      const auth = new google.auth.GoogleAuth({
        keyFile: './credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = extractSpreadsheetId(config.sheet_url);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: config.sheet_name,
      });

      const sheetData = response.data.values || [];
      if (sheetData.length === 0) {
        console.log('⚠️  No data in Google Sheets');
        continue;
      }

      const headers = sheetData[0];
      const dataRows = sheetData.slice(1); // ลบ header row
      
      console.log(`📊 Found ${dataRows.length} data rows in Google Sheets`);

      if (dataRows.length === 0) {
        console.log('⚠️  No data rows to sync');
        continue;
      }

      // แปลง column mappings
      const columnMappings = JSON.parse(config.columns);
      const mappingArray = Object.entries(columnMappings).map(([googleCol, mysqlCol]) => ({
        googleColumn: googleCol,
        mysqlColumn: mysqlCol
      }));

      // เพิ่มข้อมูลใหม่พร้อม tracking
      const columns = mappingArray.map(m => m.mysqlColumn);
      const safeColumns = columns.map(col => `\`${col}\``);
      const placeholders = columns.map(() => '?').join(', ');
      
      const insertSQL = `
        INSERT INTO \`${config.table_name}\` (${safeColumns.join(', ')}, sheet_row_index, row_hash)
        VALUES (${placeholders}, ?, ?)
      `;

      console.log('📝 Inserting fresh data with tracking...');
      let insertedCount = 0;

      for (const [index, row] of dataRows.entries()) {
        const sheetRowIndex = index + 2; // +2 เพราะ header = row 1, data เริ่ม row 2
        
        // แปลงข้อมูล
        const values = columns.map(col => {
          const mapping = mappingArray.find(m => m.mysqlColumn === col);
          if (!mapping) return null;
          
          const headerIndex = headers.findIndex(h => h === mapping.googleColumn);
          if (headerIndex === -1 || headerIndex >= row.length) return null;
          
          const value = row[headerIndex];
          return (value !== undefined && value !== null && value !== '') ? String(value).trim() : null;
        });

        // สร้าง hash
        const normalizedValues = values.map(val => {
          if (val === null || val === undefined) return '';
          return String(val).trim();
        });
        const rowHash = createRowHash(normalizedValues);

        // เพิ่มข้อมูล
        await connection.execute(insertSQL, [...values, sheetRowIndex, rowHash]);
        insertedCount++;
      }

      // อัพเดทสถานะ sync config
      await connection.execute(`
        UPDATE sync_configs 
        SET last_sync_at = CURRENT_TIMESTAMP, row_count = ?
        WHERE id = ?
      `, [insertedCount, config.id]);

      // บันทึก log
      await connection.execute(`
        INSERT INTO sync_logs (config_id, status, message, rows_synced)
        VALUES (?, 'success', ?, ?)
      `, [config.id, `Deep clean and full sync completed: ${insertedCount} rows synced`, insertedCount]);

      console.log(`✅ Successfully synced ${insertedCount} rows`);
      console.log(`🎯 Database now exactly matches Google Sheets`);
    }

    console.log('\n🎉 Deep Clean and Full Sync completed!');
    console.log('💡 Run debug-sync.js to verify the results');

  } catch (error) {
    console.error('❌ Error in deep clean:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Helper functions
function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function createRowHash(data) {
  const crypto = require('crypto');
  const rowString = data.join('|');
  return crypto.createHash('md5').update(rowString, 'utf8').digest('hex');
}

// เรียกใช้
deepCleanAndSync().catch(console.error);
