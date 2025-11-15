# Performance Tuning Guide

## การปรับปรุงประสิทธิภาพสำหรับข้อมูลหลักแสนแถว

### 1. การเปลี่ยนแปลงที่ทำไปแล้ว ✅

#### A. เพิ่มขนาด Batch และ Chunk
- **Batch Size**: 50,000 → 100,000 แถว (สำหรับข้อมูล > 100k แถว)
- **Insert Chunk**: 1,000 → 5,000 แถว/รอบ
- **Update Chunk**: 1,000 → 5,000 แถว/รอบ
- **Delete Chunk**: 1,000 → 5,000 แถว/รอบ

#### B. MySQL Connection Optimization
```javascript
{
  connectTimeout: 60000,
  multipleStatements: true,
  maxAllowedPacket: 1024 * 1024 * 100, // 100MB
}
```

#### C. MySQL Session Variables
```sql
SET SESSION sql_mode = ""
SET SESSION max_allowed_packet = 104857600  -- 100MB
SET SESSION bulk_insert_buffer_size = 16777216  -- 16MB
SET SESSION net_buffer_length = 16384  -- 16KB
```

#### D. DISABLE/ENABLE KEYS
- ปิด index ก่อน bulk insert
- เปิด index กลับหลังเสร็จ
- ช่วยเพิ่มความเร็ว INSERT 30-50%

---

### 2. การปรับแต่ง MySQL Server (ในไฟล์ my.cnf หรือ my.ini)

```ini
[mysqld]
# เพิ่ม buffer pools สำหรับ InnoDB
innodb_buffer_pool_size = 2G  # 50-80% ของ RAM
innodb_log_file_size = 512M
innodb_log_buffer_size = 64M
innodb_flush_log_at_trx_commit = 2  # เร็วกว่า แต่ risk สูงขึ้น

# ปรับ bulk insert
bulk_insert_buffer_size = 16M
max_allowed_packet = 100M

# เพิ่ม connection pool
max_connections = 200
thread_cache_size = 100

# Query cache (ถ้า MySQL < 8.0)
query_cache_type = 1
query_cache_size = 128M

# ปรับ network buffer
net_buffer_length = 16K
read_buffer_size = 2M
read_rnd_buffer_size = 8M
sort_buffer_size = 2M
```

หลังแก้ไข restart MySQL:
```bash
systemctl restart mysql
# หรือ
service mysql restart
```

---

### 3. Index Optimization

#### ตรวจสอบ Index ปัจจุบัน:
```sql
SHOW INDEX FROM ชื่อตาราง;
```

#### เพิ่ม Composite Index สำหรับ row_index:
```sql
ALTER TABLE ชื่อตาราง 
ADD INDEX idx_row_index (row_index);
```

#### เพิ่ม Index สำหรับคอลัมน์ที่ค้นหาบ่อย:
```sql
ALTER TABLE ชื่อตาราง 
ADD INDEX idx_column_name (column_name);
```

---

### 4. การใช้ Google Sheets API อย่างมีประสิทธิภาพ

#### เพิ่ม API Quota (ถ้าจำเป็น):
- Default: 100 requests/100 seconds/user
- Default: 500 requests/100 seconds/project
- สามารถขอเพิ่มได้ที่ Google Cloud Console

#### ใช้ Batch Request:
- ดึงข้อมูลหลายช่วงพร้อมกัน
- ลด API calls

---

### 5. Monitoring และ Debugging

#### ดู MySQL Performance:
```sql
-- ดู slow queries
SHOW PROCESSLIST;

-- ดู InnoDB status
SHOW ENGINE INNODB STATUS;

-- ดู buffer pool usage
SHOW STATUS LIKE 'Innodb_buffer_pool%';
```

#### ดู Logs:
```bash
# ดู sync logs
tail -f logs/sync.log

# ดู MySQL slow query log
tail -f /var/log/mysql/slow-query.log
```

---

### 6. ผลลัพธ์ที่คาดหวัง

#### ก่อนปรับปรุง:
- 100,000 แถว ≈ 5-10 นาที
- 500,000 แถว ≈ 30-60 นาที
- 1,000,000 แถว ≈ 1-2 ชั่วโมง

#### หลังปรับปรุง:
- 100,000 แถว ≈ 2-4 นาที (เร็วขึ้น 50-60%)
- 500,000 แถว ≈ 10-20 นาที (เร็วขึ้น 50-60%)
- 1,000,000 แถว ≈ 20-40 นาที (เร็วขึ้น 50-60%)

---

### 7. Tips เพิ่มเติม

#### หลีกเลี่ยง Full Sync บ่อยๆ:
- ใช้ Smart Sync (checksum) เสมอ
- Sync เฉพาะข้อมูลที่เปลี่ยน

#### แบ่ง Sheet ขนาดใหญ่:
- แบ่งเป็นหลาย Sheet ย่อย
- ซิงค์แยกกัน
- ใช้ Bulk Sync สำหรับ folder

#### Schedule Sync ในเวลาที่เหมาะสม:
- ซิงค์ตอนกลางคืน (ช่วงที่ server ไม่วุ่น)
- ใช้ Cron Job
- ตั้ง interval ที่เหมาะสม

#### Monitor ประสิทธิภาพ:
- ดู CPU, RAM, Network usage
- ปรับ batch size ตามทรัพยากร
- ใช้ PM2 monitoring

---

### 8. การ Scale ในอนาคต

#### ถ้าข้อมูลโตเกิน 10 ล้านแถว:

1. **ใช้ Database Sharding**
   - แบ่งข้อมูลไปหลาย database
   - Shard by folder หรือ date range

2. **ใช้ Message Queue (Redis/RabbitMQ)**
   - Queue sync jobs
   - Parallel workers

3. **ใช้ CDC (Change Data Capture)**
   - ซิงค์แบบ incremental
   - Real-time sync

4. **Upgrade Infrastructure**
   - เพิ่ม RAM, CPU
   - ใช้ SSD แทน HDD
   - Load Balancer สำหรับ horizontal scaling

---

## ทดสอบ Performance

```bash
# ทดสอบ sync 100k rows
time curl -X POST https://ads169th.com/api/sync/manual \
  -H "Content-Type: application/json" \
  -d '{"configId": "xxx"}'

# ดู resource usage
top
htop
```

---

## สรุป

การปรับปรุงนี้จะทำให้:
- ✅ เร็วขึ้น 50-60%
- ✅ รองรับข้อมูลหลักแสนถึงล้านแถว
- ✅ ใช้ทรัพยากรมีประสิทธิภาพมากขึ้น
- ✅ Scale ได้ดีขึ้น

**หมายเหตุ**: ผลลัพธ์จริงขึ้นกับ:
- ความเร็ว network
- Server specs (CPU, RAM, Disk)
- MySQL configuration
- Google Sheets API quota
