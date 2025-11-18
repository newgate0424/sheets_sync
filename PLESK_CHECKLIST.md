# 📋 Plesk Deployment Checklist

## ก่อน Deploy

### ไฟล์ที่ต้องเตรียม
- [ ] `.env` - กรอกข้อมูลครบถ้วน
- [ ] `credentials.json` - Download จาก Google Cloud Console
- [ ] `package.json` - ตรวจสอบ dependencies
- [ ] `app.js` - Startup file

### ข้อมูลที่ต้องมี
- [ ] MongoDB URI (จาก MongoDB Atlas)
- [ ] MySQL/PostgreSQL credentials
- [ ] Google Service Account credentials
- [ ] Domain name สำหรับ Plesk
- [ ] Admin password (strong password)
- [ ] Cron tokens (random strings)

### ตรวจสอบระบบ
- [ ] Node.js >= 18.x
- [ ] Git installed
- [ ] Database created
- [ ] Plesk Obsidian access

## ขั้นตอน Deploy บน Plesk

### 1. Plesk Setup
- [ ] เข้า Plesk admin panel
- [ ] สร้าง/เลือก domain
- [ ] เปิดใช้งาน Node.js (เวอร์ชัน 18.x+)
- [ ] ตั้ง Application mode = Production
- [ ] ตั้ง Startup file = `app.js`

### 2. Upload Code
- [ ] Setup Git repository ใน Plesk
- [ ] หรือ Upload ไฟล์ผ่าน File Manager
- [ ] ตั้งค่า deployment script = `.plesk-deploy.sh`

### 3. Upload Sensitive Files
- [ ] Upload `.env` (chmod 600)
- [ ] Upload `credentials.json` (chmod 600)
- [ ] ตรวจสอบ ownership ของไฟล์

### 4. Environment Variables
ตั้งค่าใน Plesk Node.js → Custom environment variables:
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] (หรือใช้ไฟล์ .env)

### 5. Database Setup
- [ ] สร้าง MySQL database ใน Plesk
- [ ] สร้าง database user
- [ ] บันทึก credentials
- [ ] อัพเดทใน `.env`
- [ ] เพิ่ม server IP ใน MongoDB Atlas whitelist

### 6. Build & Deploy
```bash
# SSH to server
ssh user@yourdomain.com

# Go to project directory
cd /var/www/vhosts/yourdomain.com/httpdocs

# Run setup script
bash plesk-setup.sh
```

หรือใช้ Git auto-deployment:
```bash
git push origin master
```

### 7. Start Application
- [ ] ใน Plesk Node.js, คลิก "Enable Node.js"
- [ ] คลิก "Restart App"
- [ ] ตรวจสอบ status = "Running"

## หลัง Deploy

### Testing
- [ ] เปิด `https://yourdomain.com`
- [ ] ทดสอบ login page
- [ ] ตรวจสอบ `/api/health`
- [ ] ทดสอบ database connection
- [ ] ทดสอบ Google Sheets sync

### Monitoring
- [ ] ดู logs ใน Plesk
- [ ] ตรวจสอบ error logs
- [ ] Monitor CPU/Memory usage
- [ ] Setup uptime monitoring

### Security
- [ ] Enable SSL (Let's Encrypt)
- [ ] ตรวจสอบ file permissions
- [ ] Change default admin password
- [ ] Setup firewall rules
- [ ] Enable automatic updates

### Backup
- [ ] Setup database backup schedule
- [ ] Backup `.env` file
- [ ] Backup `credentials.json`
- [ ] Document server configuration

## Troubleshooting

### Application ไม่ Start
```bash
# Check logs
tail -f logs/*.log

# Check Node.js version
node --version

# Test startup manually
node app.js
```

### Database Connection Error
```bash
# Test MySQL
mysql -h localhost -u user -p

# Check .env
cat .env | grep DATABASE

# Check MongoDB
node -e "require('mongodb').MongoClient.connect(process.env.MONGODB_URI)"
```

### Port Already in Use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

## สคริปต์ที่มีให้ใช้

- `plesk-setup.sh` - Setup เริ่มต้นบน server
- `check-plesk-ready.sh` - ตรวจสอบความพร้อมก่อน deploy
- `.plesk-deploy.sh` - Auto deployment script
- `check-production.sh` - Health check script

## Support

หากพบปัญหา:
1. ดู `PLESK_DEPLOYMENT.md` สำหรับคู่มือโดยละเอียด
2. ตรวจสอบ logs
3. รัน health check scripts
4. ดู Plesk documentation

---

**Last Updated**: 2025-11-18  
**Status**: Ready for Plesk Obsidian ✅
