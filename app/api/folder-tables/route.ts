import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - สร้างตารางในโฟลเดอร์
export async function POST(request: NextRequest) {
  try {
    const { dataset, folderName, tableName } = await request.json();
    
    if (!dataset || !folderName || !tableName) {
      return NextResponse.json({ error: 'Dataset, folder name, and table name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    await connection.query(
      'INSERT INTO folder_tables (dataset_name, folder_name, table_name) VALUES (?, ?, ?)',
      [dataset, folderName, tableName]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบตารางจากโฟลเดอร์
export async function DELETE(request: NextRequest) {
  try {
    const { dataset, folderName, tableName } = await request.json();
    
    if (!dataset || !folderName || !tableName) {
      return NextResponse.json({ error: 'Dataset, folder name, and table name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    await connection.query(
      'DELETE FROM folder_tables WHERE dataset_name = ? AND folder_name = ? AND table_name = ?',
      [dataset, folderName, tableName]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
