import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';
import { ObjectId } from 'mongodb';
import { ensureDbInitialized } from '@/lib/dbAdapter';

// GET - ดึงโฟลเดอร์ทั้งหมด
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getMongoDb();
    const folders = await db.collection('folders').find({}).sort({ name: 1 }).toArray();
    const folderTables = await db.collection('folder_tables').find({}).sort({ folder_id: 1, table_name: 1 }).toArray();
    
    return NextResponse.json({ 
      folders: folders.map(f => ({ ...f, id: f._id.toString() })), 
      folderTables: folderTables.map(ft => ({ ...ft, id: ft._id.toString() }))
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - สร้างโฟลเดอร์ใหม่
export async function POST(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { folderName, description } = await request.json();
    
    if (!folderName) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    
    await db.collection('folders').insertOne({
      name: folderName,
      description: description || null,
      created_at: new Date()
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - เปลี่ยนชื่อโฟลเดอร์
export async function PUT(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { folderId, newName } = await request.json();
    
    if (!folderId || !newName) {
      return NextResponse.json({ error: 'Folder ID and new name are required' }, { status: 400 });
    }
    
    await db.collection('folders').updateOne(
      { _id: new ObjectId(folderId) },
      { $set: { name: newName, updated_at: new Date() } }
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
    const db = await getMongoDb();
    const { folderId } = await request.json();
    
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }
    
    // ดึงรายการตารางในโฟลเดอร์ก่อนลบ
    const folderObjectId = new ObjectId(folderId);
    const tables = await db.collection('folder_tables')
      .find({ folder_id: folderObjectId })
      .toArray();
    
    // ลบตารางจริงจากฐานข้อมูล (MySQL/PostgreSQL)
    if (tables.length > 0) {
      const pool = await ensureDbInitialized();
      
      // ดึง dbType ก่อน
      const mongoSettings = await db.collection('settings').findOne({ key: 'database_connection' });
      const dbType = mongoSettings?.dbType || 'mysql';
      
      console.log(`🗑️  Deleting ${tables.length} tables from folder...`);
      
      for (const table of tables) {
        try {
          // ลบตารางจริง (ใช้ double quotes สำหรับ PostgreSQL)
          await pool.query(`DROP TABLE IF EXISTS "${table.table_name}"`);
          console.log(`✅ Deleted table: ${table.table_name}`);
          
          // ลบ sync_config ของตารางนี้ด้วย
          if (dbType === 'mysql') {
            await pool.query('DELETE FROM sync_config WHERE table_name = ?', [table.table_name]);
          } else {
            await pool.query('DELETE FROM sync_config WHERE table_name = $1', [table.table_name]);
          }
          console.log(`✅ Deleted sync_config for: ${table.table_name}`);
        } catch (error: any) {
          console.error(`❌ Error deleting table ${table.table_name}:`, error.message);
          // ถ้าลบไม่ได้ ให้ return error
          throw new Error(`Failed to delete table ${table.table_name}: ${error.message}`);
        }
      }
    }
    
    // ลบ records ใน folder_tables
    const result = await db.collection('folder_tables').deleteMany({ folder_id: folderObjectId });
    
    // ลบโฟลเดอร์
    await db.collection('folders').deleteOne({ _id: folderObjectId });
    
    return NextResponse.json({ 
      success: true,
      deletedTables: result.deletedCount
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
