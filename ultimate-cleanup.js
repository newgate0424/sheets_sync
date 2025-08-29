require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306')
};

async function ultimateCleanup() {
  let connection;
  
  try {
    console.log('🔗 เชื่อมต่อฐานข้อมูล...');
    connection = await mysql.createConnection(dbConfig);
    
    // หยุด background processes ทั้งหมดก่อน
    console.log('\n🛑 หยุด background sync processes...');
    try {
      await fetch('http://localhost:3000/api/sync/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      
      await fetch('http://localhost:3000/api/smart-auto', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' })
      });
      
      console.log('✅ หยุด background processes สำเร็จ');
    } catch (error) {
      console.log('⚠️ ไม่สามารถหยุด API ได้ - ดำเนินการต่อ');
    }
    
    console.log('\n⏳ รอ 5 วินาทีให้ processes หยุดสมบูรณ์...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const tableName = 'aoy';
    
    // ตรวจสอบข้อมูลก่อนทำความสะอาด
    const [beforeCount] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    console.log(`\n📊 ก่อนทำความสะอาด: ${beforeCount[0].count} แถว`);
    
    // แสดงข้อมูลซ้ำ
    const [duplicates] = await connection.execute(`
      SELECT sheet_row_index, COUNT(*) as count 
      FROM \`${tableName}\`
      WHERE sheet_row_index IS NOT NULL
      GROUP BY sheet_row_index
      ORDER BY sheet_row_index
    `);
    
    console.log('\n🔍 การกระจายของ sheet_row_index:');
    for (const dup of duplicates) {
      const status = dup.count > 1 ? '❌ ซ้ำ' : '✅';
      console.log(`   แถว ${dup.sheet_row_index}: ${dup.count} records ${status}`);
    }
    
    // ลบข้อมูลทั้งหมด
    console.log('\n🗑️ ลบข้อมูลทั้งหมด (TRUNCATE)...');
    await connection.execute(`TRUNCATE TABLE \`${tableName}\``);
    console.log('✅ ลบข้อมูลทั้งหมดสำเร็จ');
    
    // ดึงข้อมูลใหม่จาก Google Sheets
    console.log('\n📄 ดึงข้อมูลใหม่จาก Google Sheets...');
    
    // อ่าน config จาก database
    const [configs] = await connection.execute(`
      SELECT id, name, table_name, sheet_url, sheet_name 
      FROM sync_configs 
      WHERE table_name = ? AND is_active = 1
    `, [tableName]);
    
    if (configs.length === 0) {
      console.log('❌ ไม่พบ config สำหรับตาราง', tableName);
      return;
    }
    
    const config = configs[0];
    
    // Setup Google Sheets API
    const { google } = require('googleapis');
    const sheets = google.sheets('v4');
    
    // อ่าน service account credentials
    const credentials = require('./credentials.json');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    
    // แยก spreadsheet ID จาก URL
    const urlMatch = config.sheet_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!urlMatch) {
      console.log('❌ ไม่สามารถแยก spreadsheet ID จาก URL ได้');
      return;
    }
    const spreadsheetId = urlMatch[1];
    
    // ดึงข้อมูลจาก Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: config.sheet_name,
    });
    
    const sheetData = response.data.values || [];
    const dataRows = sheetData.slice(1).filter(row => row.some(cell => cell && cell.trim())); // ข้าม header และแถวว่าง
    
    console.log(`📊 พบข้อมูล ${dataRows.length} แถวใน Google Sheets`);
    
    if (dataRows.length === 0) {
      console.log('⚠️ ไม่พบข้อมูลใน Google Sheets');
      return;
    }
    
    // Insert ข้อมูลใหม่พร้อม tracking columns
    console.log('\n📝 Insert ข้อมูลใหม่พร้อม tracking columns...');
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const sheetRowIndex = i + 2; // Google Sheets row (เริ่มจาก 2)
      
      // สร้าง row_hash
      const crypto = require('crypto');
      const rowString = row.join('|');
      const rowHash = crypto.createHash('md5').update(rowString).digest('hex');
      
      const name = row[0] || null;
      const date = row[1] || null;
      const mess = row[2] || null;
      
      await connection.execute(`
        INSERT INTO \`${tableName}\` (name, date, mess, sheet_row_index, row_hash, synced_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [name, date, mess, sheetRowIndex, rowHash]);
      
      console.log(`   ✅ Insert แถว ${sheetRowIndex}: "${name}" | "${date}" | "${mess}"`);
    }
    
    // ตรวจสอบผลลัพธ์
    const [afterCount] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    console.log(`\n📊 หลังทำความสะอาด: ${afterCount[0].count} แถว`);
    
    // อัพเดท sync_configs
    await connection.execute(`
      UPDATE sync_configs 
      SET row_count = ?, last_sync_at = NOW()
      WHERE table_name = ?
    `, [dataRows.length, tableName]);
    
    // เพิ่ม sync log
    await connection.execute(`
      INSERT INTO sync_logs (config_id, status, message, created_at)
      SELECT id, 'success', 'ULTIMATE cleanup: fresh sync (? rows)', NOW()
      FROM sync_configs WHERE table_name = ?
    `, [dataRows.length, tableName]);
    
    // ตรวจสอบว่าไม่มี duplicates
    const [finalCheck] = await connection.execute(`
      SELECT sheet_row_index, COUNT(*) as count 
      FROM \`${tableName}\`
      GROUP BY sheet_row_index
      HAVING COUNT(*) > 1
    `);
    
    if (finalCheck.length === 0) {
      console.log('\n🎉 ทำความสะอาดสำเร็จ! ไม่มีข้อมูลซ้ำ');
    } else {
      console.log('\n⚠️ ยังพบข้อมูลซ้ำ:');
      for (const dup of finalCheck) {
        console.log(`   แถว ${dup.sheet_row_index}: ${dup.count} records`);
      }
    }
    
    console.log('\n✅ การทำความสะอาดเสร็จสิ้น!');
    console.log('💡 ใช้ node debug-sync.js เพื่อตรวจสอบผลลัพธ์');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

ultimateCleanup();
