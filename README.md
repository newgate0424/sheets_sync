# Next.js Google Sheets Sync Manager

เว็บไซต์จัดการซิงค์ข้อมูลจาก Google Sheets ไปยังฐานข้อมูล (MySQL/PostgreSQL/MongoDB)

## 🚀 Quick Start (ติดตั้งแล้วใช้ได้เลย)

```bash
# 1. ติดตั้ง
npm install

# 2. Build
npm run build

# 3. รัน
npm start

# 4. เข้าใช้งาน
# เปิด: http://localhost:3000
# Login: admin / admin123
```

**เท่านี้ก็ใช้งานได้แล้ว!** 🎉

---

## ✨ ฟีเจอร์

## ✨ ฟีเจอร์

- ✅ ซิงค์ข้อมูลจาก Google Sheets อัตโนมัติ
- ✅ รองรับ MySQL, PostgreSQL และ MongoDB
- ✅ Cron Jobs สำหรับ scheduled sync
- ✅ User Management และ Authentication

## การติดตั้ง

1. Install dependencies:
```bash
npm install
```

ระบบจะสร้างไฟล์ `.env` อัตโนมัติพร้อมค่า default

#### 2. ตั้งค่าฐานข้อมูล (Optional)

แก้ไขไฟล์ `.env`:

```env
# MongoDB (สำหรับ user management)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sheets_sync
DATABASE_USER_URL=mongodb+srv://user:pass@cluster.mongodb.net/sheets_sync

# MySQL/PostgreSQL (สำหรับเก็บข้อมูล)
DATABASE_URL=mysql://user:password@localhost:3306/database
```

**หมายเหตุ**: ถ้าไม่ตั้งค่า แอพจะรันในโหมด development (ข้อมูลไม่ persist)

#### 3. Google Sheets API (Optional)

1. Download `credentials.json` จาก [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. วางไฟล์ที่ root ของโปรเจค

**หมายเหตุ**: ถ้าไม่มี Google Sheets sync จะใช้ไม่ได้ แต่แอพยังรันได้ปกติ

#### 4. Build และ Run
```bash
# Build
npm run build

# Development mode
npm run dev

# Production mode
npm start
```

#### 5. เข้าใช้งาน

เปิดเบราว์เซอร์: **http://localhost:3000**

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

## 🚀 Deploy to Production

### Plesk Obsidian
ดูคู่มือใน **[PLESK_DEPLOYMENT.md](PLESK_DEPLOYMENT.md)**

### Production Server
ดูคู่มือใน **[PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)**

---

## 📁 โครงสร้างโปรเจค

```
├── app/
│   ├── layout.tsx              # Main layout
│   ├── page.tsx                # Home page
│   ├── api/                    # API Routes
│   │   ├── auth/              # Authentication
│   │   ├── sync-table/        # Google Sheets sync
│   │   ├── cron-jobs/         # Cron management
│   │   └── ...                # Other APIs
│   ├── database/              # Database explorer
│   ├── cron/                  # Cron jobs page
│   ├── users/                 # User management
│   └── settings/              # Settings page
├── lib/
│   ├── db.ts                  # Database connection
│   ├── dbAdapter.ts           # Multi-DB adapter
│   ├── mongoDb.ts             # MongoDB connection
│   ├── googleSheets.ts        # Google Sheets API
│   └── cronScheduler.ts       # Cron scheduler
├── components/
│   ├── Header.tsx             # Header component
│   └── Sidebar.tsx            # Sidebar component
├── scripts/                   # Utility scripts
├── .env                       # Environment variables (auto-created)
├── credentials.json           # Google API credentials (optional)
├── app.js                     # Production server
└── setup.js                   # Auto-setup script
```

---

## 🔧 Scripts

```bash
npm run dev          # Development mode
npm run build        # Build for production
npm start            # Production mode
npm run lint         # Lint code

# PM2 (Process Manager)
npm run pm2:start    # Start with PM2
npm run pm2:stop     # Stop
npm run pm2:restart  # Restart
npm run pm2:logs     # View logs
```

---

## ⚙️ Environment Variables

สร้างไฟล์ `.env` (จะถูกสร้างอัตโนมัติหลัง npm install):

```env
# MongoDB (User Management)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/sheets_sync
DATABASE_USER_URL=mongodb+srv://user:pass@cluster.mongodb.net/sheets_sync

# Database (Data Storage)
DATABASE_URL=mysql://user:password@localhost:3306/database

# Security Tokens
CRON_SYNC_TOKEN=your_secure_random_token
NEXT_PUBLIC_CRON_TOKEN=your_public_token

# Admin Account
ADMIN_PASSWORD=your_strong_password

# Server
NODE_ENV=production
PORT=3000
```

---

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - เริ่มใช้งานเร็ว (แนะนำ)
- **[PLESK_DEPLOYMENT.md](PLESK_DEPLOYMENT.md)** - Deploy บน Plesk
- **[PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)** - Deploy Production
- **[PLESK_CHECKLIST.md](PLESK_CHECKLIST.md)** - Checklist สำหรับ Plesk

---

## ⚠️ Troubleshooting

### แอพไม่รัน

```bash
# ตรวจสอบ Node.js version (ต้อง >= 18.x)
node --version

# ลบและติดตั้งใหม่
rm -rf node_modules .next
npm install
npm run build
```

### credentials.json not found

แอพจะรันได้ แต่ Google Sheets sync ใช้ไม่ได้  
Download จาก Google Cloud Console แล้ววางที่ root

### Database connection error

แอพจะรันในโหมด in-memory (ข้อมูลไม่ persist)  
ตั้งค่า DATABASE_URL ใน `.env`

---

## 🔒 Security

- เปลี่ยน `ADMIN_PASSWORD` ใน production
- ใช้ strong tokens สำหรับ `CRON_SYNC_TOKEN`
- ตั้งค่า file permissions: `chmod 600 .env credentials.json`
- Enable HTTPS สำหรับ production

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/newgate0424/sheets_sync/issues)
- **Documentation**: อ่านไฟล์ `.md` ในโปรเจค

---

## 📄 License

Private Project

---

**Version**: 2.0  
**Last Updated**: 2025-11-18  
**Status**: Production Ready ✅

**Quick Start**: `npm install && npm run build && npm start` 🚀
│   │   └── page.tsx        # Logs page
│   └── api/
│       ├── datasets/       # API to fetch databases
│       ├── query/          # API to execute SQL queries
│       └── logs/           # API to fetch logs
├── components/
│   ├── Header.tsx          # Header component
│   └── Sidebar.tsx         # Sidebar component
└── lib/
    └── db.ts               # PostgreSQL connection
```

## Stack

- **Next.js 14** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **pg** - PostgreSQL Client
- **Lucide React** - Icons

## หน้าต่างๆ

### 1. หน้าแรก (/)
- แสดงภาพรวมของระบบ
- ลิงก์ไปหน้า Database และ Logs

### 2. Database Explorer (/database)
- แสดง datasets และ tables ในรูปแบบ tree
- Query Editor สำหรับรัน SQL
- แสดงผลลัพธ์ในรูปแบบตาราง

### 3. Logs (/log)
- แสดงประวัติกิจกรรมของระบบ
- กรองตาม level (info, warning, error, success)
- ค้นหา logs

## หมายเหตุ

- ตรวจสอบให้แน่ใจว่า PostgreSQL server กำลังทำงาน
- แก้ไข DATABASE_URL ใน `.env.local` ให้ถูกต้อง
- Layout ปรับขนาดอัตโนมัติตามขนาดหน้าจอ (responsive)
