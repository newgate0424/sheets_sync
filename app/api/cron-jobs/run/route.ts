import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';
import { ObjectId } from 'mongodb';
import { performSync } from '@/lib/syncService';

// POST - รัน cron job ทันที
export async function POST(request: NextRequest) {
  try {
    console.log('[Run Job] Starting manual job execution...');
    
    const db = await getMongoDb();
    const { jobId } = await request.json();
    
    console.log('[Run Job] Job ID:', jobId);
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    // ดึงข้อมูล job
    const job = await db.collection('cron_jobs').findOne({ _id: new ObjectId(jobId) });
    
    if (!job) {
      console.error('[Run Job] Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    console.log('[Run Job] Found job:', job.name, 'table:', job.table);
    
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
      // เรียก sync service โดยตรง (ไม่ใช้ HTTP fetch)
      console.log(`[Run Job] Calling sync service directly for table: ${job.table}`);
      
      const result = await performSync({
        dataset: process.env.DATABASE_NAME || 'sheets_sync',
        tableName: job.table,
        forceSync: false
      });
      
      if (result.success) {
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
          data: result.stats
        });
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (syncError: any) {
      console.error('[Run Job] Sync error:', syncError);
      console.error('[Run Job] Error details:', {
        message: syncError.message,
        cause: syncError.cause,
        code: syncError.code
      });
      
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
        error: `Sync failed: ${syncError.message}` 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Run Job] Fatal error:', error);
    console.error('[Run Job] Error stack:', error.stack);
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Unknown error',
      details: {
        name: error.name,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
