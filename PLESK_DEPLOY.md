# Plesk Obsidian Deployment Guide

## วิธี Deploy บน Plesk Obsidian

### 1. เตรียมข้อมูล
- ✅ Upload โค้ดทั้งหมดไปที่ `/httpdocs` หรือ root directory ของ domain
- ✅ อัปโหลด `credentials.json` ไปที่ root directory
- ✅ สร้างไฟล์ `.env` (copy จาก `.env.example` และใส่ค่าจริง)

### 2. ตั้งค่า Node.js Application ใน Plesk

1. ไปที่ **Websites & Domains** → เลือก domain
2. คลิก **Node.js**
3. คลิก **Enable Node.js**
4. ตั้งค่าดังนี้:
   - **Node.js version**: เลือก 18.x หรือสูงกว่า
   - **Application mode**: Production
   - **Application root**: `/httpdocs` (หรือตาม path ที่อัปโหลด)
   - **Application URL**: `/` (หรือ path ที่ต้องการ)
   - **Application startup file**: `server.js`

### 3. ติดตั้ง Dependencies

เปิด **SSH Terminal** หรือใช้ **Web Terminal** ใน Plesk:

```bash
cd /var/www/vhosts/yourdomain.com/httpdocs
npm install
```

### 4. Setup Database

```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

### 5. Build Application

```bash
npm run build
```

หรือใช้ script:
```bash
bash build.sh
```

### 6. เริ่ม Application

กด **Restart App** ใน Node.js settings หรือรันคำสั่ง:

```bash
bash start.sh
```

### 7. ตั้งค่า Environment Variables (ถ้ามี)

ใน Plesk Node.js settings → **Environment Variables**:
- `NODE_ENV=production`
- `PORT=3000` (หรือ port ที่ Plesk กำหนด)
- คัดลอกค่าจาก `.env` มาใส่

### 8. ตั้งค่า Apache/Nginx Proxy (ถ้าจำเป็น)

Plesk จะตั้งค่า reverse proxy ให้อัตโนมัติ แต่ถ้าต้องการปรับแต่ง:

**Apache Proxy:**
```apache
ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```

**Nginx Proxy:**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 9. PM2 Alternative (ถ้าไม่ใช้ Node.js Extension)

ติดตั้ง PM2:
```bash
npm install -g pm2
```

รัน app ด้วย PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

ดู status:
```bash
pm2 status
pm2 logs sheets-sync
```

### 10. ตรวจสอบ Application

เข้าไปที่ `https://yourdomain.com` ควรเห็นหน้า login

**ข้อมูล Login เริ่มต้น:**
- Username: `admin`
- Password: `sync2024`

### Troubleshooting

**ปัญหา: App ไม่ขึ้น**
```bash
# ดู logs
pm2 logs sheets-sync
# หรือ
tail -f logs/err.log
```

**ปัญหา: Database Connection**
- ตรวจสอบ `DATABASE_URL` ใน `.env`
- ตรวจสอบว่า MySQL running
- ตรวจสอบ credentials และ permissions

**ปัญหา: Port ซ้ำ**
- เปลี่ยน `PORT` ใน `.env` หรือ `server.js`

**ปัญหา: Google Sheets API**
- ตรวจสอบว่า `credentials.json` อยู่ที่ root directory
- ตรวจสอบว่า Service Account มีสิทธิ์เข้าถึง Sheets

### Update Code

```bash
cd /var/www/vhosts/yourdomain.com/httpdocs
git pull origin master
npm install
npm run build
pm2 restart sheets-sync
# หรือ
# Restart App ใน Plesk Node.js settings
```

---

## ไฟล์สำคัญที่สร้างไว้:

1. **`server.js`** - Node.js HTTP server สำหรับรัน Next.js
2. **`ecosystem.config.js`** - PM2 configuration
3. **`app.json`** - Plesk Node.js app configuration
4. **`build.sh`** - Script สำหรับ build
5. **`start.sh`** - Script สำหรับ start application

---

## คำสั่งที่ใช้บ่อย:

```bash
# Build
npm run build

# Start (development)
npm run dev

# Start (production with server.js)
node server.js

# Start (production with Next.js CLI)
npm start

# Check status (PM2)
pm2 status

# Restart (PM2)
pm2 restart sheets-sync

# View logs (PM2)
pm2 logs sheets-sync

# Database push
npx prisma db push

# Database studio
npx prisma studio
```
