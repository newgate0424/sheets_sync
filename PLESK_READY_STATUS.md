# ✅ สรุปสถานะโปรเจคสำหรับ Plesk Obsidian

**วันที่ตรวจสอบ**: 2025-11-18  
**สถานะ**: **พร้อม Deploy ✅** (มีข้อควรระวัง)

---

## 📊 สรุปผลการตรวจสอบ

### ✅ สิ่งที่พร้อมใช้งาน

1. **โครงสร้างโปรเจค** ✅
   - Next.js 14 Application
   - Custom server (`app.js`)
   - API Routes ครบถ้วน
   - Authentication & Middleware
   - Database adapter (MySQL/PostgreSQL/MongoDB)

2. **ไฟล์ Configuration** ✅
   - `.env` - มีข้อมูล MongoDB และ MySQL แล้ว
   - `package.json` - Dependencies ครบถ้วน
   - `next.config.js` - พร้อมใช้งาน
   - `ecosystem.config.json` - PM2 config

3. **Plesk Scripts** ✅
   - `plesk-setup.sh` - Setup script
   - `plesk-start.sh` - Startup script
   - `.plesk-deploy.sh` - Auto deployment
   - `check-plesk-ready.sh` - Readiness check

4. **Documentation** ✅
   - `PLESK_DEPLOYMENT.md` - คู่มือ deploy ละเอียด
   - `PLESK_CHECKLIST.md` - Checklist ทุกขั้นตอน
   - `PRODUCTION_DEPLOY.md` - Production guide

---

## ⚠️ สิ่งที่ต้องทำก่อน Deploy

### 1. **credentials.json (CRITICAL)**
❌ **ไฟล์นี้ยังไม่มี** - ต้องสำหรับ Google Sheets API

**วิธีแก้**:
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. สร้าง Service Account
3. Download credentials.json
4. วางไฟล์ที่ root ของโปรเจค
5. ตั้งค่า `chmod 600 credentials.json`

### 2. **แก้ไข .env (บางค่า)**
✅ มีไฟล์แล้ว แต่ต้องเช็คว่าข้อมูลถูกต้อง:

```bash
# ข้อมูลปัจจุบันใน .env:
MONGODB_URI=mongodb+srv://sanewgate:newgate0424@data-ads.jxyonoc.mongodb.net/...
DATABASE_URL=mysql://adsthcom_sacom_kung:...@147.50.228.21:3306/...
```

**ต้องเช็ค**:
- [ ] MongoDB Atlas whitelist IP ของ Plesk server
- [ ] MySQL server (147.50.228.21) เข้าถึงได้จาก Plesk
- [ ] `CRON_SYNC_TOKEN` - ควรเปลี่ยนเป็นค่าใหม่
- [ ] `ADMIN_PASSWORD` - ควรเปลี่ยนจาก default

### 3. **Node.js Version บน Plesk**
ต้องตั้งค่าใน Plesk:
- Node.js >= 18.x (แนะนำ 18.x หรือ 20.x)

---

## 🚀 ขั้นตอนการ Deploy

### Option 1: ใช้ Git (แนะนำ)

```bash
# 1. Push code to GitHub
git add .
git commit -m "Ready for Plesk deployment"
git push origin master

# 2. ใน Plesk
# - ไปที่ Git section
# - Add repository: https://github.com/newgate0424/sheets_sync
# - Set deployment script: .plesk-deploy.sh
# - Enable automatic deployment

# 3. Upload sensitive files manually
# - Upload credentials.json
# - ตรวจสอบ .env
```

### Option 2: Upload Manual

```bash
# 1. Upload ไฟล์ทั้งหมดผ่าน Plesk File Manager
# 2. SSH to server
ssh user@yourserver.com

# 3. Go to project directory
cd /var/www/vhosts/yourdomain.com/httpdocs

# 4. Run setup
bash plesk-setup.sh
```

---

## 📋 Plesk Configuration

### Node.js Settings
ตั้งค่าใน **Websites & Domains > Node.js**:

```
Application Mode: production
Node.js Version: 18.x หรือใหม่กว่า
Application Root: /httpdocs (หรือ /)
Application Startup File: app.js
```

### Environment Variables
เพิ่มใน **Custom environment variables**:

```
NODE_ENV=production
PORT=3000
```

(หรือใช้ไฟล์ .env ที่มีอยู่แล้ว)

---

## 🔍 การทดสอบ

### 1. Health Check
```bash
curl https://yourdomain.com/api/health
```

ควรได้:
```json
{"status":"ok","timestamp":"..."}
```

### 2. Test Database
```bash
# SSH to server
cd /var/www/vhosts/yourdomain.com/httpdocs

# Test MySQL
mysql -h 147.50.228.21 -u adsthcom_sacom_kung -p

# Test MongoDB
node -e "require('mongodb').MongoClient.connect('mongodb+srv://...')"
```

### 3. Test Application
1. เปิด `https://yourdomain.com/login`
2. Login ด้วย admin account
3. ทดสอบ sync Google Sheets

---

## 📁 ไฟล์ที่สร้างใหม่

1. **plesk-setup.sh** - Setup script สำหรับ Plesk
2. **plesk-start.sh** - Startup script
3. **check-plesk-ready.sh** - ตรวจสอบความพร้อม
4. **plesk.config.json** - Configuration file
5. **PLESK_DEPLOYMENT.md** - คู่มือโดยละเอียด
6. **PLESK_CHECKLIST.md** - Checklist
7. **.pleskignore** - ไฟล์ที่ไม่ต้อง deploy
8. **fix-line-endings.bat** - แก้ line endings (Windows)

---

## 🎯 Action Items

### ก่อน Deploy (ทำบน Local)
- [ ] Download `credentials.json` จาก Google Cloud
- [ ] วางไฟล์ `credentials.json` ใน project root
- [ ] รัน `check-plesk-ready.sh` เพื่อเช็คความพร้อม
- [ ] Commit และ push to GitHub

### บน Plesk Server
- [ ] Setup Git deployment หรือ upload files
- [ ] Upload `credentials.json` (chmod 600)
- [ ] ตรวจสอบ `.env` (chmod 600)
- [ ] ตั้งค่า Node.js application
- [ ] รัน `bash plesk-setup.sh`
- [ ] Enable และ Restart application

### หลัง Deploy
- [ ] ทดสอบ `/api/health`
- [ ] Login ทดสอบ
- [ ] ทดสอบ Google Sheets sync
- [ ] Setup SSL certificate
- [ ] Setup monitoring
- [ ] Setup backup

---

## ⚡ Quick Start

```bash
# 1. เตรียมไฟล์
# - Download credentials.json จาก Google Cloud
# - วางใน project root

# 2. ตรวจสอบความพร้อม
bash check-plesk-ready.sh

# 3. Push to Git
git add .
git commit -m "Ready for Plesk"
git push origin master

# 4. Deploy บน Plesk
# - Setup Git repository
# - หรือ Upload files manually
# - Run: bash plesk-setup.sh
```

---

## 📞 หากมีปัญหา

### ปัญหาที่อาจพบ

1. **credentials.json not found**
   - Download จาก Google Cloud Console
   - Upload to project root
   - `chmod 600 credentials.json`

2. **MongoDB connection failed**
   - เพิ่ม Plesk server IP ใน MongoDB Atlas Network Access
   - เช็ค connection string ใน .env

3. **MySQL connection failed**
   - ตรวจสอบว่า 147.50.228.21 เข้าถึงได้จาก Plesk
   - เช็ค username/password
   - ลอง ping และ telnet

4. **Application won't start**
   - ดู logs ใน Plesk
   - เช็ค Node.js version >= 18.x
   - รัน `node app.js` manually เพื่อดู error

### Logs Location

```bash
# Application logs
/var/www/vhosts/yourdomain.com/httpdocs/logs/

# Plesk logs
/var/www/vhosts/yourdomain.com/logs/proxy_error_log
/var/www/vhosts/yourdomain.com/logs/error_log
```

---

## 📚 เอกสารเพิ่มเติม

- **PLESK_DEPLOYMENT.md** - คู่มือ deploy ทีละขั้นตอน
- **PLESK_CHECKLIST.md** - Checklist แบบละเอียด
- **PRODUCTION_DEPLOY.md** - Production deployment guide
- **README.md** - คู่มือใช้งานระบบ

---

## ✅ สรุปท้ายสุด

**สถานะ**: ✅ **พร้อม Deploy บน Plesk Obsidian**

**สิ่งที่ต้องทำเพิ่ม**:
1. ✅ ไฟล์และ config พร้อมแล้ว
2. ❌ ต้อง download `credentials.json` (CRITICAL)
3. ⚠️ ควรเช็คและอัพเดทค่าใน `.env` ให้ตรงกับ production

**การ Deploy**:
- ใช้ Git auto-deployment (แนะนำ)
- หรือ Upload manual ผ่าน Plesk File Manager
- รัน `plesk-setup.sh` บน server

**เวลาประมาณ**: 15-30 นาที (รวม setup และทดสอบ)

---

**Created**: 2025-11-18  
**Ready for Production**: ✅ YES (with credentials.json)
