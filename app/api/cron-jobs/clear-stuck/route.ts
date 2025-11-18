import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';

// POST - เคลียร์ jobs ที่ค้าง running
export async function POST() {
  try {
    const db = await getMongoDb();
    
    // หา jobs ทั้งหมดที่ status = running
    const stuckJobs = await db.collection('cron_jobs')
      .find({ status: 'running' })
      .toArray();
    
    if (stuckJobs.length === 0) {
      return NextResponse.json({ 
        message: 'No stuck jobs found',
        count: 0
      });
    }
    
    // Reset status เป็น failed
    const result = await db.collection('cron_jobs').updateMany(
      { status: 'running' },
      { 
        $set: { 
          status: 'failed',
          updated_at: new Date()
        }
      }
    );
    
    console.log(`[Cron] Cleared ${result.modifiedCount} stuck jobs`);
    
    return NextResponse.json({ 
      success: true,
      message: `Cleared ${result.modifiedCount} stuck jobs`,
      count: result.modifiedCount,
      jobs: stuckJobs.map(j => j.name)
    });
  } catch (error: any) {
    console.error('Error clearing stuck jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
