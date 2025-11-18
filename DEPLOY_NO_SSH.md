# 🚀 Deployment without SSH (Plesk Only)

## วิธี Deploy บน Plesk โดยไม่ใช้ SSH

### วิธีที่ 1: Git Auto-Deploy (แนะนำ)

#### 1. Setup Git ใน Plesk
1. ใน Plesk, ไปที่ **Git** (Websites & Domains > Git)
2. คลิก **Add Repository**
3. กรอกข้อมูล:
   ```
   Repository Name: sheets_sync
   Repository URL: https://github.com/newgate0424/sheets_sync.git
   Repository Path: /httpdocs
   Branch: master
   ```
4. ✅ เปิด **Enable automatic deployment**
5. ตั้งค่า:
   ```
   Deployment mode: Deploy to the repository path
   Deployment script: .plesk-deploy.sh
   ```
6. คลิก **OK**

#### 2. Deploy
```bash
# บน Local (Windows)
git add .
git commit -m "Update for Plesk"
git push origin master
```

Plesk จะ deploy อัตโนมัติ!

---

### วิธีที่ 2: Upload Manual ผ่าน Plesk File Manager

#### 1. Build บน Local
```powershell
# บน Windows
npm install
npm run build
```

#### 2. Upload ไฟล์ผ่าน Plesk
1. ใน Plesk, ไปที่ **Files** > **File Manager**
2. ไปที่ `/httpdocs`
3. Upload ไฟล์/folder เหล่านี้:
   - ✅ `.next/` (ทั้ง folder)
   - ✅ `node_modules/` (ทั้ง folder) หรือจะลบแล้ว npm install ใหม่ก็ได้
   - ✅ `app/`
   - ✅ `lib/`
   - ✅ `components/`
   - ✅ `public/` (ถ้ามี)
   - ✅ `app.js`
   - ✅ `package.json`
   - ✅ `.env`
   - ✅ `credentials.json`
   - ✅ `next.config.js`
   - ✅ ไฟล์อื่นๆ ที่จำเป็น

#### 3. Run Commands ผ่าน Plesk Scheduled Tasks

สร้าง Scheduled Task ใน Plesk เพื่อรันคำสั่ง:

1. ไปที่ **Scheduled Tasks**
2. เพิ่ม task ใหม่:
   ```bash
   cd /var/www/vhosts/yourdomain.com/httpdocs && npm install --production
   ```
3. รัน **Run Now**
4. เพิ่ม task อีกอัน:
   ```bash
   cd /var/www/vhosts/yourdomain.com/httpdocs && touch tmp/restart.txt
   ```
5. รัน **Run Now**

---

### วิธีที่ 3: ใช้ Plesk Node.js UI (ง่ายที่สุด)

#### 1. Upload ไฟล์ที่สำคัญ
ผ่าน File Manager:
- `app.js`
- `package.json`
- `.env`
- `credentials.json`
- ทั้ง folders: `app/`, `lib/`, `components/`

#### 2. ใช้ Plesk Node.js Interface
1. ไปที่ **Node.js** settings
2. คลิก **NPM Install**
3. คลิก **NPM Run** > เลือก `build`
4. คลิก **Enable Node.js**
5. คลิก **Restart App**

---

## 🔧 Troubleshooting without SSH

### ดู Logs ผ่าน Plesk UI

#### 1. Application Logs
- ไปที่ **Node.js** > **Show Logs**

#### 2. Error Logs
- ไปที่ **Logs** > **Error Log**
- เลือก domain ของคุณ
- ดู recent entries

#### 3. Download Logs
- ใน **Logs** section
- คลิก **Download** เพื่อ download log file
- เปิดดูบนเครื่องตัวเอง

---

## 📝 Checklist สำหรับการ Deploy แบบไม่มี SSH

### ก่อน Deploy
- [ ] รัน `npm install` บน local
- [ ] รัน `npm run build` บน local
- [ ] ตรวจสอบว่า `.next` folder ถูกสร้าง
- [ ] เตรียม `.env` และ `credentials.json`

### Upload ผ่าน File Manager
- [ ] Upload `.next/` folder
- [ ] Upload `node_modules/` (หรือจะให้ Plesk install ก็ได้)
- [ ] Upload source code folders (`app/`, `lib/`, `components/`)
- [ ] Upload `app.js`, `package.json`
- [ ] Upload `.env`, `credentials.json`
- [ ] ตั้งค่า permissions: `.env` = 600, `credentials.json` = 600

### ใน Plesk Node.js Settings
- [ ] Application Startup File: `app.js`
- [ ] Application Mode: `Production`
- [ ] Node.js Version: 18.x หรือสูงกว่า
- [ ] คลิก **NPM Install** (ถ้ายังไม่ได้ upload node_modules)
- [ ] คลิก **Enable Node.js**
- [ ] คลิก **Restart App**

---

## 🎯 Quick Deploy Steps (No SSH)

### Option A: Git (Recommended)
```powershell
# บน Windows
git add .
git commit -m "Deploy to Plesk"
git push origin master
```
✅ Plesk deploy อัตโนมัติ

### Option B: Manual Upload
1. Build บน local: `npm run build`
2. Zip ไฟล์ที่จำเป็น
3. Upload zip ผ่าน Plesk File Manager
4. Extract zip ใน Plesk
5. ใน Node.js settings: คลิก **Restart App**

### Option C: Sync Tools
ใช้ tools เช่น:
- FileZilla (SFTP)
- WinSCP
- Plesk's built-in File Manager

---

## 📦 สร้าง Deployment Package

เพื่อให้ upload ง่าย สร้างไฟล์ zip:

### บน Windows:
```powershell
# สร้าง build
npm run build

# สร้าง zip (ไม่รวม node_modules เพื่อประหยัดเวลา)
# ใช้ 7-Zip หรือ WinRAR หรือ PowerShell:
Compress-Archive -Path .next,app,lib,components,app.js,package.json,.env,credentials.json,next.config.js,ecosystem.config.json -DestinationPath deploy.zip
```

### Upload deploy.zip:
1. ไปที่ Plesk File Manager
2. Upload `deploy.zip`
3. คลิกขวา > Extract
4. ใน Node.js: คลิก **NPM Install**
5. คลิก **Restart App**

---

## ⚠️ Important Notes

### ไฟล์ที่ต้อง Upload เสมอ:
- `.next/` - Build output (สำคัญมาก!)
- `app.js` - Entry point
- `package.json` - Dependencies list
- `.env` - Configuration
- `credentials.json` - Google API

### ไฟล์ที่ไม่ต้อง Upload:
- `node_modules/` - ให้ Plesk install ใหม่
- `.git/` - Git history
- `logs/` - จะถูกสร้างใหม่

### File Permissions (ตั้งใน Plesk File Manager):
```
.env -> 600
credentials.json -> 600
folders -> 755
files อื่นๆ -> 644
```

---

## 🔄 การ Restart Application

### ผ่าน Plesk UI:
1. ไปที่ **Node.js**
2. คลิก **Restart App**

### ผ่าน File Manager:
1. ไปที่ `/httpdocs/tmp/`
2. สร้าง/แก้ไขไฟล์ `restart.txt`
3. บันทึก (หรือแค่ touch ไฟล์)
4. Passenger จะ restart อัตโนมัติ

---

## 📞 หากเจอปัญหา

### 1. Application ไม่รัน
- ดู Logs ใน Plesk Node.js > Show Logs
- ตรวจสอบว่า `.next` folder มีหรือไม่
- ตรวจสอบ Node.js version >= 18

### 2. "Something went wrong"
- Build ใหม่บน local: `npm run build`
- Upload `.next` folder ใหม่
- Restart app ใน Plesk

### 3. Dependencies Error
- ใน Plesk Node.js: คลิก **NPM Install**
- รอจนเสร็จ (อาจใช้เวลา 2-5 นาที)
- Restart app

---

## ✅ Success Indicators

เมื่อ deploy สำเร็จ คุณจะเห็น:
- ใน Node.js Logs: "Server Started Successfully!"
- Status: "Running" (สีเขียว)
- เข้าเว็บได้: `https://yourdomain.com`
- Login ได้: admin / admin123

---

**Created**: 2025-11-18  
**No SSH Required**: ✅ YES  
**Plesk UI Only**: ✅ YES
