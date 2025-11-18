import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';
import { ObjectId } from 'mongodb';

// GET - ดึง cron logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status');
    
    const db = await getMongoDb();
    
    // สร้าง filter
    const filter: any = {};
    if (jobId) {
      filter.job_id = new ObjectId(jobId);
    }
    if (status) {
      filter.status = status;
    }
    
    const logs = await db.collection('cron_logs')
      .find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .project({ 
        // เลือกเฉพาะ fields ที่ต้องการเพื่อลด payload
        job_id: 1,
        job_name: 1,
        folder: 1,
        table: 1,
        status: 1,
        started_at: 1,
        completed_at: 1,
        duration_ms: 1,
        message: 1,
        error: 1
      })
      .toArray();
    
    return NextResponse.json({ 
      logs: logs.map(log => ({ 
        ...log, 
        id: log._id.toString(),
        _id: undefined,
        job_id: log.job_id?.toString()
      }))
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบ logs เก่า
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const db = await getMongoDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await db.collection('cron_logs').deleteMany({
      created_at: { $lt: cutoffDate }
    });
    
    return NextResponse.json({ 
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
