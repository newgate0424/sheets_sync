import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - ดึงโฟลเดอร์ทั้งหมด
export async function GET() {
  try {
    const connection = await pool.getConnection();
    
    // สร้างตาราง folders ถ้ายังไม่มี
    await connection.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dataset_name VARCHAR(255) NOT NULL,
        folder_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_folder (dataset_name, folder_name)
      )
    `);

    // สร้างตาราง folder_tables ถ้ายังไม่มี
    await connection.query(`
      CREATE TABLE IF NOT EXISTS folder_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dataset_name VARCHAR(255) NOT NULL,
        folder_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_table (dataset_name, folder_name, table_name)
      )
    `);

    const [folders]: any = await connection.query('SELECT * FROM folders ORDER BY dataset_name, folder_name');
    const [folderTables]: any = await connection.query('SELECT * FROM folder_tables ORDER BY dataset_name, folder_name, table_name');
    
    connection.release();
    
    return NextResponse.json({ folders, folderTables });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - สร้างโฟลเดอร์ใหม่
export async function POST(request: NextRequest) {
  try {
    const { dataset, folderName } = await request.json();
    
    if (!dataset || !folderName) {
      return NextResponse.json({ error: 'Dataset and folder name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    await connection.query(
      'INSERT INTO folders (dataset_name, folder_name) VALUES (?, ?)',
      [dataset, folderName]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - เปลี่ยนชื่อโฟลเดอร์
export async function PUT(request: NextRequest) {
  try {
    const { dataset, oldName, newName } = await request.json();
    
    if (!dataset || !oldName || !newName) {
      return NextResponse.json({ error: 'Dataset, old name, and new name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    await connection.query(
      'UPDATE folders SET folder_name = ? WHERE dataset_name = ? AND folder_name = ?',
      [newName, dataset, oldName]
    );

    await connection.query(
      'UPDATE folder_tables SET folder_name = ? WHERE dataset_name = ? AND folder_name = ?',
      [newName, dataset, oldName]
    );
    
    connection.release();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบโฟลเดอร์
export async function DELETE(request: NextRequest) {
  try {
    const { dataset, folderName } = await request.json();
    
    if (!dataset || !folderName) {
      return NextResponse.json({ error: 'Dataset and folder name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    
    // ดึงรายการตารางในโฟลเดอร์
    const [tables]: any = await connection.query(
      'SELECT table_name FROM folder_tables WHERE dataset_name = ? AND folder_name = ?',
      [dataset, folderName]
    );

    // ลบตารางจริงจากฐานข้อมูล
    for (const table of tables) {
      try {
        await connection.query(`DROP TABLE IF EXISTS \`${dataset}\`.\`${table.table_name}\``);
        console.log(`Deleted table: ${dataset}.${table.table_name}`);
      } catch (error) {
        console.error(`Error deleting table ${table.table_name}:`, error);
      }

      // ลบ sync_config ของตารางนี้ด้วย
      try {
        await connection.query(
          'DELETE FROM sync_config WHERE dataset_name = ? AND table_name = ?',
          [dataset, table.table_name]
        );
      } catch (error) {
        console.error(`Error deleting sync_config for ${table.table_name}:`, error);
      }
    }
    
    // ลบความสัมพันธ์ใน folder_tables
    await connection.query(
      'DELETE FROM folder_tables WHERE dataset_name = ? AND folder_name = ?',
      [dataset, folderName]
    );

    // ลบโฟลเดอร์
    await connection.query(
      'DELETE FROM folders WHERE dataset_name = ? AND folder_name = ?',
      [dataset, folderName]
    );
    
    connection.release();
    
    return NextResponse.json({ 
      success: true,
      deletedTables: tables.length
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
