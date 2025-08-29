// ทดสอบกับ Google Sheet ของคุณ
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

// ใส่ URL ของ Google Sheet ที่คุณต้องการทดสอบ
const YOUR_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YoK5BDXh3J8qnuvaPhJvdst7v4Xatn6DywiQ7SepPVI/edit';

function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function testYourSheet() {
  const sheetId = extractSheetId(YOUR_SHEET_URL);
  
  if (!sheetId) {
    console.log('❌ URL ไม่ถูกต้อง');
    return;
  }

  console.log('🧪 ทดสอบ Google Sheet ของคุณ...');
  console.log('🔗 URL:', YOUR_SHEET_URL);
  console.log('🆔 Sheet ID:', sheetId);

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ดึง metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    console.log('✅ เชื่อมต่อสำเร็จ!');
    console.log('📋 ชื่อ Sheet:', spreadsheet.data.properties?.title);
    
    const sheetNames = spreadsheet.data.sheets?.map(sheet => 
      sheet.properties?.title
    ) || [];
    
    console.log('📄 Tabs ที่มี:', sheetNames);

    // ทดสอบดึงข้อมูลจาก tab แรก
    if (sheetNames.length > 0) {
      const firstSheet = sheetNames[0];
      console.log('\n📊 ดึงข้อมูลจาก tab:', firstSheet);
      
      const values = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${firstSheet}!A1:Z20`,
      });

      const rows = values.data.values || [];
      console.log('📈 จำนวนแถว:', rows.length);
      
      if (rows.length > 0) {
        console.log('🏷️  Column Headers:', rows[0]);
        
        if (rows.length > 1) {
          console.log('📝 ตัวอย่างข้อมูลแถวที่ 2:', rows[1]);
        }
        
        if (rows.length > 2) {
          console.log('📝 ตัวอย่างข้อมูลแถวที่ 3:', rows[2]);
        }

        console.log('\n🎉 พร้อมใช้งานแล้ว!');
        console.log('📝 คุณสามารถใช้ URL นี้ในระบบได้เลย');
        console.log('🔗', YOUR_SHEET_URL);
      }
    }

  } catch (error) {
    console.log('\n❌ เกิดข้อผิดพลาด:', error.message);
    
    if (error.code === 403) {
      console.log('💡 วิธีแก้ไข:');
      console.log('1. เปิด Google Sheet นี้:', YOUR_SHEET_URL);
      console.log('2. คลิค Share');
      console.log('3. เพิ่ม email: newgate@possible-point-428513-k6.iam.gserviceaccount.com');
      console.log('4. ให้สิทธิ์ Viewer');
      console.log('5. คลิก Send');
    }
  }
}

testYourSheet();