import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sheets_sync',
  waitForConnections: true,
  connectionLimit: 3,  // ลดจำนวน connections เยอะ
  queueLimit: 0
});

export default pool;

// ฟังก์ชันสำหรับสร้าง tables (ไม่สร้าง database)
export async function initDatabase() {
  try {
    console.log('Initializing database tables...');
    
    // สร้างตาราง sync_configs
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sync_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sheet_url TEXT NOT NULL,
        sheet_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        columns JSON NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMP NULL,
        row_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // สร้างตาราง sync_logs
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_id INT NOT NULL,
        status ENUM('success', 'error') NOT NULL,
        message TEXT,
        rows_synced INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_id) REFERENCES sync_configs(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
}