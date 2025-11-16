import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const connection = await pool.getConnection();
    const results = [];

    // สร้างตาราง folders
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS folders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          folder_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.push('✓ folders table created');
    } catch (error: any) {
      results.push('✗ folders: ' + error.message);
    }

    // สร้างตาราง folder_tables
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS folder_tables (
          id INT AUTO_INCREMENT PRIMARY KEY,
          folder_id INT NOT NULL,
          table_name VARCHAR(255) NOT NULL,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
          UNIQUE KEY unique_table (folder_id, table_name)
        )
      `);
      results.push('✓ folder_tables table created');
    } catch (error: any) {
      results.push('✗ folder_tables: ' + error.message);
    }

    // สร้างตาราง sync_config
    try {
      await connection.query(`
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
        )
      `);
      results.push('✓ sync_config table created');
    } catch (error: any) {
      results.push('✗ sync_config: ' + error.message);
    }

    // สร้างตาราง sync_logs
    try {
      await connection.query(`
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
        )
      `);
      results.push('✓ sync_logs table created');
    } catch (error: any) {
      results.push('✗ sync_logs: ' + error.message);
    }

    // สร้างตาราง users
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          role ENUM('admin', 'user') DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_login TIMESTAMP NULL,
          INDEX idx_username (username),
          INDEX idx_role (role)
        )
      `);
      results.push('✓ users table created');

      // สร้าง admin account เริ่มต้น (username: admin, password: admin123)
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await connection.query(`
        INSERT IGNORE INTO users (username, password, full_name, role)
        VALUES ('admin', ?, 'ผู้ดูแลระบบ', 'admin')
      `, [hashedPassword]);
      
      results.push('✓ Default admin user created (username: admin, password: admin123)');
    } catch (error: any) {
      results.push('✗ users: ' + error.message);
    }

    connection.release();

    return NextResponse.json({ 
      success: true, 
      message: 'Migration completed',
      results: results
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: error.message,
      details: 'Failed to run migration'
    }, { status: 500 });
  }
}
