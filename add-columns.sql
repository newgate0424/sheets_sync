-- สำหรับ MySQL
ALTER TABLE sync_config 
ADD COLUMN start_row INT DEFAULT 1 COMMENT 'แถวแรกที่เริ่มอ่านข้อมูล (1-indexed)';

ALTER TABLE sync_config 
ADD COLUMN has_header TINYINT(1) DEFAULT 1 COMMENT 'แถวแรกเป็น header หรือไม่ (1=ใช่, 0=ไม่)';

-- หรือถ้าใช้ PostgreSQL ให้รันแทน:
-- ALTER TABLE sync_config ADD COLUMN IF NOT EXISTS start_row INTEGER DEFAULT 1;
-- ALTER TABLE sync_config ADD COLUMN IF NOT EXISTS has_header BOOLEAN DEFAULT TRUE;
