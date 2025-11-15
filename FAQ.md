# คำถามที่พบบ่อย (FAQ)

## คำถามเกี่ยวกับระบบ

### Q: ระบบรองรับข้อมูลได้มากแค่ไหน?
A: ระบบออกแบบมาเพื่อรองรับข้อมูลถึง 10 ล้านแถว โดยใช้วิธี Batch Processing ประมวลผลทีละ 50,000 แถว

### Q: ใช้เวลาเท่าไหร่ในการซิงค์ข้อมูล 1 ล้านแถว?
A: โดยเฉลี่ยใช้เวลาประมาณ 10-15 นาที (ขึ้นอยู่กับ Network Speed และ Server Performance)

### Q: ระบบจัดการกับข้อมูลที่เปลี่ยนแปลงอย่างไร?
A: ระบบใช้ MD5 Checksum เปรียบเทียบแต่ละแถว จะอัปเดตเฉพาะแถวที่มีการเปลี่ยนแปลงเท่านั้น

### Q: สามารถซิงค์หลายชีตพร้อมกันได้หรือไม่?
A: ได้ สามารถสร้างหลาย Config และซิงค์แบบอิสระได้

## คำถามเกี่ยวกับ Google Sheets

### Q: ต้องแชร์ Google Sheets ให้ Service Account หรือไม่?
A: ใช่ ต้องแชร์ให้ Service Account Email พร้อมสิทธิ์ Viewer หรือ Editor

### Q: รองรับ Google Sheets ที่มี Formula หรือไม่?
A: ได้ ระบบจะดึงค่าที่คำนวณแล้ว (Rendered Value) ไม่ใช่ Formula

### Q: รองรับ Sheet ที่มี Merged Cells หรือไม่?
A: รองรับ แต่แนะนำให้หลีกเลี่ยงเพื่อความเรียบร้อยของข้อมูล

### Q: ขนาดไฟล์ Google Sheets สูงสุดที่รองรับคือเท่าไหร่?
A: รองรับตาม Limit ของ Google Sheets คือ 10 ล้านเซลล์ต่อ Spreadsheet

## คำถามเกี่ยวกับ Database

### Q: รองรับ Database อะไรบ้าง?
A: ปัจจุบันรองรับเฉพาะ MySQL/MariaDB แต่สามารถปรับให้รองรับ PostgreSQL ได้

### Q: จะเปลี่ยนชนิดข้อมูล (Data Type) ของคอลัมน์ได้หรือไม่?
A: ไม่สามารถเปลี่ยนหลังสร้างตารางแล้ว ต้องลบตารางและสร้างใหม่

### Q: ข้อมูลในตารางจะถูกลบหรือไม่เมื่อซิงค์?
A: ระบบจะลบเฉพาะแถวที่ถูกลบใน Google Sheets เท่านั้น

### Q: รองรับ Index หรือ Foreign Key หรือไม่?
A: มี Index พื้นฐานที่ row_index อยู่แล้ว สามารถเพิ่ม Index เองผ่าน MySQL ได้

## คำถามเกี่ยวกับการซิงค์

### Q: การซิงค์ทำงานแบบ Real-time หรือไม่?
A: ไม่ใช่ Real-time 100% แต่สามารถตั้งค่าให้ซิงค์ทุก 30 วินาทีผ่าน Cron Job

### Q: จะซิงค์เฉพาะช่วงเวลาหนึ่งได้หรือไม่?
A: ได้ โดยใช้ Cron Job กำหนดเวลาตามต้องการ

### Q: จะดูประวัติการซิงค์ได้ที่ไหน?
A: ดูได้ที่ตาราง `SyncLog` ในฐานข้อมูล หรือเรียก API `/api/sync/logs`

### Q: ถ้าซิงค์ล้มเหลวจะทำอย่างไร?
A: ระบบจะบันทึก Error ลง SyncLog สามารถกดซิงค์ใหม่ได้ทันที

## คำถามเกี่ยวกับ Performance

### Q: จะเพิ่มความเร็วในการซิงค์ได้อย่างไร?
A: 
1. เพิ่ม MySQL Connection Pool Size
2. ใช้ SSD แทน HDD
3. เพิ่ม RAM ของ Server
4. ลด Batch Size หากมี Memory Error

### Q: ระบบใช้ Memory มากไหม?
A: ใช้ประมาณ 200-500 MB สำหรับการซิงค์ข้อมูล 50,000 แถว

### Q: สามารถรันบน Shared Hosting ได้หรือไม่?
A: ไม่แนะนำ ควรใช้ VPS หรือ Cloud Server ที่มี Node.js และ MySQL

## คำถามเกี่ยวกับความปลอดภัย

### Q: ข้อมูล Google Sheets ปลอดภัยหรือไม่?
A: ใช่ ระบบใช้ Service Account Authentication ไม่เก็บ Password

### Q: API_SECRET_KEY ใช้ทำอะไร?
A: ใช้ป้องกันการเรียก Cron Job API โดยไม่ได้รับอนุญาต

### Q: สามารถเข้ารหัสข้อมูลได้หรือไม่?
A: ปัจจุบันยังไม่รองรับ แต่สามารถปรับปรุงเพิ่มได้

## คำถามเกี่ยวกับ Cron Job

### Q: Windows รองรับ Cron Job หรือไม่?
A: ใช้ Task Scheduler แทน หรือใช้บริการ Cron Online เช่น cron-job.org

### Q: จะรันซิงค์ทุก 30 วินาทีได้อย่างไร?
A: ใช้บริการ Cron Online ที่รองรับ เช่น cron-job.org (ฟรี)

### Q: Cron Job Timeout ทำอย่างไร?
A: API Cron รันแบบ Async ไม่ต้องรอให้ซิงค์เสร็จ ไม่มี Timeout

## คำถามเกี่ยวกับการพัฒนา

### Q: สามารถปรับแต่งหรือเพิ่มฟีเจอร์ได้หรือไม่?
A: ได้ โค้ดเป็น Open Source และมี Architecture ที่ขยายได้ง่าย

### Q: จะเพิ่มการแจ้งเตือนเมื่อซิงค์เสร็จได้หรือไม่?
A: ได้ สามารถเพิ่ม Email/Slack Notification ใน `src/lib/sync.ts`

### Q: รองรับ TypeScript หรือไม่?
A: ใช่ โปรเจคนี้เขียนด้วย TypeScript ทั้งหมด

## คำถามเกี่ยวกับ License

### Q: สามารถใช้เชิงพาณิชย์ได้หรือไม่?
A: ได้ ภายใต้ MIT License

### Q: ต้องเสียค่าใช้จ่ายหรือไม่?
A: ไม่ ระบบฟรีและ Open Source

## ปัญหาที่พบบ่อย

### "Cannot find module 'googleapis'"
```powershell
npm install
```

### "Access denied for user"
ตรวจสอบ DATABASE_URL ใน `.env`

### "Permission denied" Google Sheets
ตรวจสอบว่าแชร์ให้ Service Account แล้ว

### "Port 3000 already in use"
```powershell
$env:PORT="3001"
npm run dev
```

### "Prisma Client Error"
```powershell
npm run prisma:generate
```

## ติดต่อและสนับสนุน

หากมีคำถามเพิ่มเติม:
- เปิด Issue บน GitHub
- ส่ง Email ถึงผู้พัฒนา
- ติดตาม Documentation ใน README.md
