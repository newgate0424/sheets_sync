// ทดสอบ Service Account
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');

async function testServiceAccount() {
  console.log('🔑 ทดสอบ Service Account...\n');

  try {
    // อ่าน credentials.json
    const credentialsPath = './credentials.json';
    
    if (!fs.existsSync(credentialsPath)) {
      console.log('❌ ไม่พบไฟล์ credentials.json');
      return;
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    console.log('✅ พบไฟล์ credentials.json');
    console.log('📧 Service Account Email:', credentials.client_email);
    console.log('🆔 Project ID:', credentials.project_id);

    // สร้าง auth
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ สร้าง Google Sheets client สำเร็จ');

    // ทดสอบกับ sheet ที่ต้องแชร์ให้ service account
    console.log('\n📝 สำหรับการทดสอบ กรุณา:');
    console.log('1. เปิด Google Sheets ที่ต้องการใช้');
    console.log('2. คลิก Share');
    console.log('3. เพิ่ม email นี้:', credentials.client_email);
    console.log('4. ให้สิทธิ์ Viewer');
    console.log('5. กด Send');

    // ถ้าคุณมี sheet ID ที่แชร์แล้ว ให้ใส่ตรงนี้เพื่อทดสอบ
    const TEST_SHEET_ID = '1YoK5BDXh3J8qnuvaPhJvdst7v4Xatn6DywiQ7SepPVI'; // แทนด้วย Sheet ID ของคุณ
    
    if (TEST_SHEET_ID) {
      console.log('\n🧪 ทดสอบเข้าถึง Sheet...');
      console.log('📊 Sheet ID:', TEST_SHEET_ID);

      try {
        // ดึง metadata
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: TEST_SHEET_ID,
        });

        console.log('✅ เข้าถึง Sheet สำเร็จ!');
        console.log('📋 Sheet Title:', spreadsheet.data.properties?.title);
        
        const sheetNames = spreadsheet.data.sheets?.map(sheet => 
          sheet.properties?.title
        ) || [];
        console.log('📄 Sheet tabs:', sheetNames.join(', '));

        // ทดสอบดึงข้อมูล
        if (sheetNames.length > 0) {
          const firstSheet = sheetNames[0];
          const values = await sheets.spreadsheets.values.get({
            spreadsheetId: TEST_SHEET_ID,
            range: `${firstSheet}!A1:Z10`,
          });

          const rows = values.data.values || [];
          console.log('📊 ข้อมูลที่พบ:', rows.length, 'แถว');
          
          if (rows.length > 0) {
            console.log('🏷️  Headers:', rows[0]);
            if (rows.length > 1) {
              console.log('📝 ตัวอย่างข้อมูล:', rows[1]);
            }
          }

          console.log('\n🎉 Service Account พร้อมใช้งาน!');
        }

      } catch (error) {
        if (error.code === 403) {
          console.log('❌ ไม่มีสิทธิ์เข้าถึง Sheet');
          console.log('💡 กรุณาแชร์ Google Sheet ให้กับ:', credentials.client_email);
        } else if (error.code === 404) {
          console.log('❌ ไม่พบ Sheet หรือ Sheet ID ไม่ถูกต้อง');
        } else {
          console.log('❌ Error:', error.message);
        }
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testServiceAccount();