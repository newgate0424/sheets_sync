# Google Sheets to MySQL Sync System

ระบบซิงค์ข้อมูลจาก Google Sheets ไปยัง MySQL Database แบบเรียลไทม์ รองรับข้อมูลขนาดใหญ่ถึง 10 ล้านแถว

## คุณสมบัติหลัก

- 📊 **ซิงค์ข้อมูลอัตโนมัติ**: ซิงค์ข้อมูลทีละ 50,000 แถว
- 🔄 **Smart Sync**: ตรวจจับและอัปเดตเฉพาะข้อมูลที่เปลี่ยนแปลง
- ⚡ **Real-time**: รองรับการซิงค์ทุก 30 วินาที
- 🗄️ **Auto Schema**: สร้าง Table อัตโนมัติจาก Google Sheets
- 📈 **Dashboard**: แสดงสถานะและสถิติข้อมูลแบบเรียลไทม์
- 🔗 **Cron Job Support**: URL สำหรับเรียกใช้งานผ่าน Cron Job

## การติดตั้ง

1. ติดตั้ง dependencies:
\`\`\`bash
npm install
\`\`\`

2. ตั้งค่า environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`
แก้ไขไฟล์ `.env` ให้ตรงกับค่าของคุณ (เฉพาะ DATABASE_URL และ API_SECRET_KEY)

3. วางไฟล์ `credentials.json` (Google Service Account) ที่ root ของโปรเจค

3. ตั้งค่า Prisma และ Database:
\`\`\`bash
npm run prisma:generate
npm run prisma:push
\`\`\`

4. รันโปรเจค:
\`\`\`bash
npm run dev
\`\`\`

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

## การตั้งค่า Google Service Account

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจคใหม่หรือเลือกโปรเจคที่มีอยู่
3. เปิดใช้งาน Google Sheets API
4. สร้าง Service Account และดาวน์โหลด JSON key
5. เปลี่ยนชื่อไฟล์เป็น `credentials.json` และวางที่ root ของโปรเจค
6. แชร์ Google Sheets ของคุณให้กับ Service Account Email (ดูจาก credentials.json)

## โครงสร้างโปรเจค

\`\`\`
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── config/          # หน้าตั้งค่าชีต
│   │   ├── dashboard/       # Dashboard
│   │   ├── tables/          # แสดงข้อมูลตาราง
│   │   └── page.tsx         # Home page
│   ├── lib/
│   │   ├── db.ts           # Database client
│   │   ├── google-sheets.ts # Google Sheets API
│   │   └── sync.ts         # Sync logic
│   └── types/              # TypeScript types
└── README.md
\`\`\`

## API Endpoints

- `POST /api/sheets/validate` - ตรวจสอบลิงค์ Google Sheets
- `GET /api/sheets/list` - ดึงรายการชีตทั้งหมด
- `POST /api/sheets/config` - บันทึกการตั้งค่าชีต
- `POST /api/sync/manual` - ซิงค์ข้อมูลแบบ Manual
- `POST /api/sync/cron` - ซิงค์ข้อมูลผ่าน Cron Job (ต้องมี API Key)
- `GET /api/stats` - ดึงสถิติข้อมูล

## การใช้งาน Cron Job

ใช้ URL นี้สำหรับตั้ง Cron Job (คลิกขวาที่ปุ่มซิงค์เพื่อคัดลอก):

\`\`\`
POST https://your-domain.com/api/sync/cron
Headers: 
  Authorization: Bearer YOUR_API_SECRET_KEY
Body: 
  { "configId": "config_id_here" }
\`\`\`

ตัวอย่าง crontab สำหรับซิงค์ทุก 30 วินาที:
\`\`\`bash
*/1 * * * * curl -X POST https://your-domain.com/api/sync/cron -H "Authorization: Bearer YOUR_API_SECRET_KEY" -H "Content-Type: application/json" -d '{"configId":"xxx"}'
\`\`\`

## ข้อจำกัดและการเพิ่มประสิทธิภาพ

- ซิงค์ทีละ 50,000 แถวเพื่อป้องกัน Memory Overflow
- ใช้ Hash Comparison เพื่อตรวจจับการเปลี่ยนแปลง
- Connection Pooling สำหรับ Database
- Retry Logic สำหรับการเรียก Google Sheets API
- Rate Limiting ป้องกันการใช้งานมากเกินไป

## License

MIT
