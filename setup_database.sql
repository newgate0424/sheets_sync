-- สร้างตารางระบบทั้งหมดสำหรับ BigQuery System
USE bigquery;

-- ตาราง folders สำหรับเก็บโฟลเดอร์
CREATE TABLE IF NOT EXISTS folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง folder_tables สำหรับความสัมพันธ์ระหว่างโฟลเดอร์กับตาราง
CREATE TABLE IF NOT EXISTS folder_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_id INT NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  UNIQUE KEY unique_table (folder_id, table_name)
);

-- ตาราง sync_config สำหรับเก็บค่าการ sync พร้อม checksum optimization
CREATE TABLE IF NOT EXISTS sync_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255),
  table_name VARCHAR(255) NOT NULL,
  spreadsheet_id VARCHAR(255) NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  last_sync TIMESTAMP NULL,
  last_checksum VARCHAR(64),
  skip_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_table (dataset_name, table_name)
);

-- ตาราง sync_logs สำหรับเก็บ log การ sync
CREATE TABLE IF NOT EXISTS sync_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  status ENUM('running', 'success', 'error', 'skipped') NOT NULL,
  rows_inserted INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_deleted INT DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table (dataset_name, table_name),
  INDEX idx_status (status),
  INDEX idx_synced_at (synced_at)
);
