# Next.js MySQL Manager

เว็บไซต์จัดการฐานข้อมูล MySQL ที่มี UI คล้าย Google BigQuery

## ฟีเจอร์

- ✅ Responsive Layout พร้อม Header และ Sidebar
- ✅ หน้า Database Explorer - เรียกดู datasets และ tables
- ✅ Query Editor - รัน SQL queries
- ✅ หน้า Logs - ติดตามกิจกรรมของระบบ
- ✅ เชื่อมต่อกับ MySQL Database

## การติดตั้ง

1. Install dependencies:
```bash
npm install
```

2. ตั้งค่าการเชื่อมต่อ MySQL ใน `.env.local`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mysql_manager
DB_PORT=3306
```

3. สร้าง database ใน MySQL:
```sql
CREATE DATABASE mysql_manager;
```

4. รันโปรเจค:
```bash
npm run dev
```

5. เปิดเบราว์เซอร์ที่ http://localhost:3000

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
    └── db.ts               # MySQL connection
```

## Stack

- **Next.js 14** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **MySQL2** - Database Connection
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

- ตรวจสอบให้แน่ใจว่า MySQL server กำลังทำงาน
- แก้ไข credentials ใน `.env.local` ให้ถูกต้อง
- Layout ปรับขนาดอัตโนมัติตามขนาดหน้าจอ (responsive)
