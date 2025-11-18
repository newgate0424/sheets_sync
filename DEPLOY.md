# คู่มือ Deploy บน Plesk

## ขั้นตอนการ Deploy

### 1. อัพโหลดไฟล์ขึ้น Plesk
- อัพโหลดโปรเจคทั้งหมดไปที่ `/httpdocs` หรือ application root
- หรือใช้ Git Deployment ใน Plesk

### 2. ติดตั้ง Node.js
ใน Plesk Panel:
1. ไปที่ **Applications** → **Node.js**
2. เลือก Node.js version **18.x** ขึ้นไป
3. คลิก **Enable Node.js**
4. Application Mode: **Production**
5. Application Root: `/httpdocs`
6. Application Startup File: `app.js`
7. Document Root: `/httpdocs`

### 3. ติดตั้ง Dependencies
เปิด SSH Terminal หรือใช้ Plesk File Manager terminal:
```bash
cd /httpdocs
npm install
npm run build
```

### 4. ตั้งค่า Environment Variables
ใน Plesk Panel → Node.js → Custom environment variables:
```
NODE_ENV=production
PORT=3000
DATABASE_USER_URL=mongodb+srv://...
CRON_SYNC_TOKEN=your-token-here
```

### 5. เริ่มต้น Application
กด **NPM Install** และ **Restart App** ใน Plesk Panel

หรือใช้ SSH Terminal:
```bash
cd /httpdocs
npm install
npm run build
node app.js
```

หรือใช้ PM2 (แนะนำ):
```bash
# ติดตั้ง PM2
npm install -g pm2

# เริ่ม app ด้วย PM2
pm2 start ecosystem.config.json

# ตั้งให้รันอัตโนมัติเมื่อ server restart
pm2 startup
pm2 save
```

### 6. ตั้งค่า Reverse Proxy (ถ้าต้องการใช้ domain)
ใน Plesk Panel → Apache & nginx Settings:

**Nginx Reverse Proxy:**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 7. ตรวจสอบว่า App ทำงาน
เปิดเว็บไซต์: `https://yourdomain.com`

### คำสั่งที่มีประโยชน์

```bash
# ดู logs
pm2 logs bigquery-app

# Restart app
pm2 restart bigquery-app

# Stop app
pm2 stop bigquery-app

# ดูสถานะ
pm2 status

# Monitor
pm2 monit
```

### Troubleshooting

**ถ้า Build ไม่ผ่าน:**
```bash
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

**ถ้าเชื่อมต่อ Database ไม่ได้:**
- ตรวจสอบ MongoDB connection string
- ตรวจสอบว่า IP server อนุญาตใน MongoDB Atlas
- เช็ค Environment Variables

**ถ้า Port 3000 ถูกใช้แล้ว:**
แก้ไข `ecosystem.config.json`:
```json
"args": "start -p 3001"
```

### Auto Deploy (Optional)

สร้างไฟล์ webhook ใน Plesk:
1. ไปที่ Git → Enable Git
2. ตั้งค่า Deploy Script:
```bash
#!/bin/bash
cd /httpdocs
git pull
npm install
npm run build
pm2 restart bigquery-app
```

---

## ตรวจสอบ System Requirements

- ✅ Node.js >= 18.0.0
- ✅ NPM >= 9.0.0
- ✅ MongoDB (external)
- ✅ RAM >= 512MB (แนะนำ 1GB+)
- ✅ Disk Space >= 1GB
