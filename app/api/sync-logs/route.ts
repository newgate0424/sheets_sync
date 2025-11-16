import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// สร้างตาราง sync_logs
async function ensureSyncLogsTable() {
  const connection = await pool.getConnection();
  
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      status ENUM('running', 'success', 'error') NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      dataset_name VARCHAR(255) NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      duration_seconds INT NULL,
      inserted INT DEFAULT 0,
      updated INT DEFAULT 0,
      deleted INT DEFAULT 0,
      error_message TEXT NULL,
      INDEX idx_table (table_name),
      INDEX idx_status (status),
      INDEX idx_started (started_at DESC)
    )
  `);
  
  connection.release();
}

export async function GET() {
  try {
    await ensureSyncLogsTable();
    
    const connection = await pool.getConnection();
    
    const [logs]: any = await connection.query(`
      SELECT 
        id,
        status,
        table_name,
        dataset_name,
        started_at,
        completed_at,
        duration_seconds,
        inserted,
        updated,
        deleted,
        error_message
      FROM sync_logs
      ORDER BY started_at DESC
      LIMIT 1000
    `);
    
    connection.release();
    
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - สร้าง log entry ใหม่
export async function POST(request: Request) {
  try {
    await ensureSyncLogsTable();
    
    const { status, tableName, datasetName, inserted, updated, deleted, errorMessage } = await request.json();
    
    const connection = await pool.getConnection();
    
    const [result]: any = await connection.query(
      `INSERT INTO sync_logs (status, table_name, dataset_name, inserted, updated, deleted, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [status, tableName, datasetName, inserted || 0, updated || 0, deleted || 0, errorMessage || null]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true, logId: result.insertId });
  } catch (error: any) {
    console.error('Error creating sync log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - อัพเดท log entry (เมื่อเสร็จสิ้น)
export async function PUT(request: Request) {
  try {
    const { logId, status, inserted, updated, deleted, errorMessage } = await request.json();
    
    const connection = await pool.getConnection();
    
    await connection.query(
      `UPDATE sync_logs 
       SET status = ?, 
           completed_at = NOW(), 
           duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW()),
           inserted = ?,
           updated = ?,
           deleted = ?,
           error_message = ?
       WHERE id = ?`,
      [status, inserted || 0, updated || 0, deleted || 0, errorMessage || null, logId]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating sync log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
