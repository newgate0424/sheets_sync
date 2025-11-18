# Next.js PostgreSQL Manager

เว็บไซต์จัดการฐานข้อมูล PostgreSQL ที่มี UI คล้าย Google BigQuery

## ฟีเจอร์

- ✅ Responsive Layout พร้อม Header และ Sidebar
- ✅ หน้า Database Explorer - เรียกดู datasets และ tables
- ✅ Query Editor - รัน SQL queries
- ✅ หน้า Logs - ติดตามกิจกรรมของระบบ
- ✅ เชื่อมต่อกับ PostgreSQL Database

## การติดตั้ง

1. Install dependencies:
```bash
npm install
```

2. ตั้งค่าการเชื่อมต่อ PostgreSQL ใน `.env.local`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ads_data"
```

3. สร้าง database ใน PostgreSQL:
```sql
CREATE DATABASE ads_data;
```

4. รันการ migrate ฐานข้อมูล:
```bash
npm run migrate
```

5. รันโปรเจค:
```bash
npm run dev
```

6. เปิดเบราว์เซอร์ที่ http://localhost:3000

## โครงสร้างโปรเจค

```
├── app/
│   ├── layout.tsx          # Main layout with Header & Sidebar
│   ├── page.tsx            # Home page
│   ├── database/
│   │   └── page.tsx        # Database explorer page
│   ├── log/
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
