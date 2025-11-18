import { NextRequest, NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';

// POST - สร้างตารางในโฟลเดอร์
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { dataset, folderName, tableName } = await request.json();
    
    if (!dataset || !folderName || !tableName) {
      return NextResponse.json({ error: 'Dataset, folder name, and table name are required' }, { status: 400 });
    }
    
    await pool.query(
      'INSERT INTO folder_tables (dataset_name, folder_name, table_name) VALUES ($1, $2, $3)',
      [dataset, folderName, tableName]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบตารางจากโฟลเดอร์
export async function DELETE(request: NextRequest) {
  try {
    const pool = await ensureDbInitialized();
    const { dataset, folderName, tableName } = await request.json();
    
    if (!dataset || !folderName || !tableName) {
      return NextResponse.json({ error: 'Dataset, folder name, and table name are required' }, { status: 400 });
    }
    
    await pool.query(
      'DELETE FROM folder_tables WHERE dataset_name = $1 AND folder_name = $2 AND table_name = $3',
      [dataset, folderName, tableName]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
