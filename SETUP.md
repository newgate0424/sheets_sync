# วิธีติดตั้งและใช้งาน

## 1. ติดตั้ง Dependencies

เปิด PowerShell และรันคำสั่ง:

```powershell
npm install
```

## 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```powershell
Copy-Item .env.example .env
```

แก้ไขไฟล์ `.env` ให้ตรงกับค่าของคุณ:

```env
# ตัวอย่าง MySQL URL
DATABASE_URL="mysql://root:@localhost:3306/sheets_sync"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
API_SECRET_KEY="your-secret-key-12345"
```

**หมายเหตุ:** Google Service Account จะอ่านจากไฟล์ `credentials.json` โดยอัตโนมัติ (ไม่ต้องใส่ใน .env)

## 3. ตั้งค่า MySQL Database

### ถ้าใช้ XAMPP:
1. เปิด XAMPP Control Panel
2. Start Apache และ MySQL
3. เปิด phpMyAdmin (http://localhost/phpmyadmin)
4. สร้าง Database ชื่อ `sheets_sync`

### ถ้าใช้ MySQL Command Line:
```sql
CREATE DATABASE sheets_sync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 4. ตั้งค่า Google Service Account

### สร้าง Service Account:
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่หรือเลือก Project ที่มี
3. ไปที่ **APIs & Services** → **Enable APIs and Services**
4. ค้นหาและเปิดใช้งาน **Google Sheets API**
5. ไปที่ **Credentials** → **Create Credentials** → **Service Account**
6. กรอกรายละเอียดและคลิก **Create**
7. ที่หน้า **Service Accounts** คลิกที่ Service Account ที่สร้าง
8. ไปที่แท็บ **Keys** → **Add Key** → **Create new key** → เลือก **JSON**
9. ไฟล์ JSON จะถูกดาวน์โหลด

### นำไฟล์มาใช้งาน:
1. เปลี่ยนชื่อไฟล์ JSON ที่ดาวน์โหลดมาเป็น `credentials.json`
2. วางไฟล์ `credentials.json` ไว้ที่ root ของโปรเจค (ที่เดียวกับ package.json)
3. ระบบจะอ่านค่าจากไฟล์นี้โดยอัตโนมัติ

**โครงสร้างไฟล์:**
```
sheet/
├── credentials.json  ← วางไฟล์ตรงนี้
├── package.json
├── .env
└── ...
```

### แชร์ Google Sheets:
1. เปิด Google Sheets ที่ต้องการซิงค์
2. คลิก **Share** (แชร์)
3. วาง Service Account Email (`xxx@xxx.iam.gserviceaccount.com`)
4. กำหนดสิทธิ์เป็น **Viewer** หรือ **Editor**
5. คลิก **Send**

## 5. ตั้งค่า Prisma และสร้าง Tables

```powershell
npm run prisma:generate
npm run prisma:push
```

## 6. รันโปรเจค

```powershell
npm run dev
```

เปิดเบราว์เซอร์ที่: http://localhost:3000

## 7. การใช้งาน

### เพิ่มการตั้งค่าชีตใหม่:
1. คลิก **ตั้งค่าชีต**
2. วาง URL ของ Google Sheets
3. เลือก Sheet และ Range
4. กำหนด Schema (ชนิดข้อมูลของแต่ละคอลัมน์)
5. บันทึก

### ซิงค์ข้อมูล:
1. ไปที่ **Dashboard**
2. คลิกปุ่ม **🔄 ซิงค์** ที่ตารางที่ต้องการ
3. รอจนกว่าการซิงค์จะเสร็จ

### ดูข้อมูล:
1. ไปที่ **ดูข้อมูล**
2. เลือกตารางที่ต้องการดู
3. เรียกดูข้อมูลแบบ Pagination

### ตั้งค่า Cron Job (สำหรับซิงค์อัตโนมัติ):
1. ที่หน้า Dashboard คลิกขวาที่ปุ่ม **ซิงค์**
2. Command จะถูกคัดลอกไปยัง Clipboard
3. แทนที่ `YOUR_API_SECRET_KEY` ด้วยค่าจริงจาก `.env`

#### วิธีตั้งค่า Cron บน Windows (Task Scheduler):
1. เปิด **Task Scheduler**
2. คลิก **Create Basic Task**
3. ตั้งชื่อ เช่น "Sync Google Sheets"
4. เลือก **Trigger**: Daily หรือ Custom
5. เลือก **Action**: Start a program
6. Program/script: `curl`
7. Add arguments: 
```
-X POST http://localhost:3000/api/sync/cron -H "Authorization: Bearer your-secret-key-12345" -H "Content-Type: application/json" -d "{\"configId\":\"YOUR_CONFIG_ID\"}"
```
8. ตั้งเวลาให้รันทุก 30 วินาที หรือตามต้องการ

#### วิธีตั้งค่า Cron บน Linux:
```bash
# แก้ไข crontab
crontab -e

# เพิ่มบรรทัดนี้เพื่อรันทุก 1 นาที
* * * * * curl -X POST https://your-domain.com/api/sync/cron -H "Authorization: Bearer your-secret-key-12345" -H "Content-Type: application/json" -d '{"configId":"YOUR_CONFIG_ID"}'
```

#### ใช้บริการ Cron Online:
- [cron-job.org](https://cron-job.org/) - ฟรี, รองรับทุก 30 วินาที
- [EasyCron](https://www.easycron.com/) - ฟรี tier รองรับทุก 1 ชั่วโมง
- [GitHub Actions](https://docs.github.com/en/actions) - ฟรีสำหรับ public repos

## 8. การ Deploy (Production)

### Deploy บน Vercel:
```powershell
npm install -g vercel
vercel
```

อย่าลืมตั้งค่า Environment Variables ใน Vercel Dashboard

### Deploy บน VPS/Server:
```bash
# Build
npm run build

# Run production
npm start
```

ใช้ PM2 สำหรับ Process Management:
```bash
npm install -g pm2
pm2 start npm --name "sheets-sync" -- start
pm2 save
pm2 startup
```

## 9. Troubleshooting

### ปัญหา: ไม่สามารถเชื่อมต่อ MySQL
- ตรวจสอบว่า MySQL รันอยู่ (XAMPP หรือ Service)
- ตรวจสอบ DATABASE_URL ใน `.env`
- ลองเชื่อมต่อผ่าน MySQL Workbench หรือ phpMyAdmin

### ปัญหา: Google Sheets API Error
- ตรวจสอบว่าเปิดใช้งาน Google Sheets API แล้ว
- ตรวจสอบว่า Service Account Email ถูกแชร์ใน Google Sheets แล้ว
- ตรวจสอบ private key ใน `.env` (ต้องมี `\n` แทน newline)

### ปัญหา: การซิงค์ช้า
- ลดขนาด Batch Size (แก้ที่ `src/lib/sync.ts` บรรทัด 160)
- เพิ่ม Connection Pool Size สำหรับ MySQL
- ตรวจสอบ Network Speed

### ปัญหา: Memory Error
- เพิ่ม Node.js Memory Limit:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
```

## 10. การอัปเดตโค้ด

```powershell
# Pull code ใหม่
git pull

# ติดตั้ง dependencies ใหม่
npm install

# อัปเดต Prisma
npm run prisma:generate
npm run prisma:push

# Restart
npm run dev
```

## ติดต่อสอบถาม
หากมีปัญหาหรือข้อสงสัย สามารถเปิด Issue ได้ที่ GitHub Repository
