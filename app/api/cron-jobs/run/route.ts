import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';
import { ObjectId } from 'mongodb';

// POST - รัน cron job ทันที
export async function POST(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    // ดึงข้อมูล job
    const job = await db.collection('cron_jobs').findOne({ _id: new ObjectId(jobId) });
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // อัพเดทสถานะเป็น running
    await db.collection('cron_jobs').updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: { 
          status: 'running',
          lastRun: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    try {
      // เรียก sync API
      const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync-table`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: process.env.DATABASE_NAME || 'sheets_sync',
          tableName: job.table
        })
      });
      
      const syncData = await syncResponse.json();
      
      if (syncResponse.ok) {
        // อัพเดทสถานะเป็น success
        await db.collection('cron_jobs').updateOne(
          { _id: new ObjectId(jobId) },
          { 
            $set: { 
              status: 'success',
              lastRun: new Date(),
              updated_at: new Date()
            }
          }
        );
        
        return NextResponse.json({ 
          success: true, 
          message: 'Job executed successfully',
          data: syncData
        });
      } else {
        throw new Error(syncData.error || 'Sync failed');
      }
    } catch (syncError: any) {
      // อัพเดทสถานะเป็น failed
      await db.collection('cron_jobs').updateOne(
        { _id: new ObjectId(jobId) },
        { 
          $set: { 
            status: 'failed',
            lastRun: new Date(),
            updated_at: new Date()
          }
        }
      );
      
      return NextResponse.json({ 
        success: false, 
        error: syncError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
