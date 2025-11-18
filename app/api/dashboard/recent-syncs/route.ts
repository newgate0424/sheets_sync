import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getMongoDb } = await import('@/lib/mongoDb');
    const db = await getMongoDb();
    
    // ดึง sync logs ล่าสุด 10 รายการ
    const recentSyncs = await db.collection('sync_logs')
      .find({})
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();
    
    // แปลง format ข้อมูล
    const formattedSyncs = recentSyncs.map(sync => ({
      table_name: sync.table_name,
      status: sync.status,
      row_count: sync.row_count || sync.stats?.total || 0,
      synced_at: sync.created_at,
      duration: sync.duration || null
    }));

    return NextResponse.json({ syncs: formattedSyncs });
  } catch (error: any) {
    console.error('Error fetching recent syncs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
