import { NextRequest, NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';

// GET - ดึงโฟลเดอร์ทั้งหมด
export async function GET() {
  try {
    const pool = await ensureDbInitialized();
    const folders = await pool.query('SELECT * FROM folders ORDER BY name');
    const folderTables = await pool.query('SELECT * FROM folder_tables ORDER BY folder_id, table_name');
    
    return NextResponse.json({ folders: folders.rows, folderTables: folderTables.rows });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - สร้างโฟลเดอร์ใหม่
export async function POST(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { folderName, description } = await request.json();
    
    if (!folderName) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    
    await pool.query(
      'INSERT INTO folders (name, description) VALUES ($1, $2)',
      [folderName, description || null]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - เปลี่ยนชื่อโฟลเดอร์
export async function PUT(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { folderId, newName } = await request.json();
    
    if (!folderId || !newName) {
      return NextResponse.json({ error: 'Folder ID and new name are required' }, { status: 400 });
    }
    
    await pool.query(
      'UPDATE folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newName, folderId]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบโฟลเดอร์
export async function DELETE(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { folderId } = await request.json();
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }
    
    // ดึงรายการตารางในโฟลเดอร์
    const tablesResult = await pool.query(
      'SELECT table_name FROM folder_tables WHERE folder_id = ?',
      [folderId]
    );

    const tables = tablesResult.rows || tablesResult;

    // ลบตารางจริงจากฐานข้อมูล
    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS \`${table.table_name}\``);
        console.log(`Deleted table: ${table.table_name}`);
      } catch (error) {
        console.error(`Error deleting table ${table.table_name}:`, error);
      }

      // ลบ sync_config ของตารางนี้ด้วย
      try {
        await pool.query(
          'DELETE FROM sync_config WHERE table_name = ?',
          [table.table_name]
        );
      } catch (error) {
        console.error(`Error deleting sync_config for ${table.table_name}:`, error);
      }
    }
    
    // ลบโฟลเดอร์ (folder_tables จะถูกลบอัตโนมัติด้วย CASCADE)
    await pool.query(
      'DELETE FROM folders WHERE id = ?',
      [folderId]
    );
    
    return NextResponse.json({ 
      success: true,
      deletedTables: tables.length
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
