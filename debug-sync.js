// debug-sync.js - ตรวจสอบการ sync และเปรียบเทียบข้อมูล
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const { google } = require('googleapis');
const fs = require('fs');

async function debugSync() {
  let connection;
  try {
    // เชื่อมต่อ database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sheets_sync'
    });

    console.log('=== DATABASE SYNC DEBUG ===\n');
    console.log(`📡 Connected to: ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);

    // ดึงรายการ sync configs
    const [configs] = await connection.execute(`
      SELECT id, name, table_name, sheet_url, sheet_name, columns, row_count, last_sync_at
      FROM sync_configs 
      WHERE is_active = 1
    `);

    if (configs.length === 0) {
      console.log('ไม่พบ sync configuration ที่ active');
      return;
    }

    for (const config of configs) {
      console.log(`\n📋 Config: ${config.name}`);
      console.log(`📊 Table: ${config.table_name}`);
      console.log(`🔗 Sheet: ${config.sheet_name}`);
      console.log(`📈 Recorded Row Count: ${config.row_count || 'N/A'}`);
      console.log(`🕒 Last Sync: ${config.last_sync_at || 'Never'}`);

      // นับแถวจริงใน database
      const [dbCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
      `);
      const actualDbCount = dbCount[0].count;
      
      console.log(`💾 Actual DB Rows: ${actualDbCount}`);

      // ตรวจสอบแถวที่ไม่มี tracking columns
      const [untracked] = await connection.execute(`
        SELECT COUNT(*) as count FROM \`${config.table_name}\`
        WHERE sheet_row_index IS NULL OR row_hash IS NULL
      `);
      const untrackedCount = untracked[0].count;
      
      if (untrackedCount > 0) {
        console.log(`⚠️  Untracked Rows: ${untrackedCount} (rows without sheet_row_index or row_hash)`);
        
        // แสดงตัวอย่างแถวที่ไม่มี tracking
        const [sampleUntracked] = await connection.execute(`
          SELECT id, sheet_row_index, row_hash FROM \`${config.table_name}\`
          WHERE sheet_row_index IS NULL OR row_hash IS NULL
          LIMIT 5
        `);
        
        console.log('📄 Sample untracked rows:');
        sampleUntracked.forEach(row => {
          console.log(`   ID: ${row.id}, sheet_row_index: ${row.sheet_row_index}, row_hash: ${row.row_hash}`);
        });
      }

      // ตรวจสอบข้อมูลใน Google Sheets
      try {
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
        const sheetRowCount = Math.max(0, sheetData.length - 1); // ลบ header row
        
        console.log(`📄 Google Sheets Rows: ${sheetRowCount} (excluding header)`);
        
        if (actualDbCount !== sheetRowCount) {
          console.log(`❌ MISMATCH! Database has ${actualDbCount} rows but Google Sheets has ${sheetRowCount} rows`);
          console.log(`📊 Difference: ${actualDbCount - sheetRowCount} rows`);
          
          if (actualDbCount > sheetRowCount) {
            console.log('💡 Database has MORE data than Google Sheets - might be duplicate sync issue');
          } else {
            console.log('💡 Google Sheets has MORE data than Database - sync might be incomplete');
          }
        } else {
          console.log('✅ Row counts match!');
        }

      } catch (sheetError) {
        console.log(`❌ Cannot access Google Sheets: ${sheetError.message}`);
      }

      // ดู sync logs ล่าสุด
      const [logs] = await connection.execute(`
        SELECT status, message, rows_synced, created_at
        FROM sync_logs 
        WHERE config_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `, [config.id]);

      if (logs.length > 0) {
        console.log('\n📊 Recent Sync Logs:');
        logs.forEach((log, i) => {
          console.log(`   ${i + 1}. [${log.status}] ${log.message} (${log.rows_synced} rows) - ${log.created_at}`);
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

function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// เรียกใช้
debugSync().catch(console.error);
