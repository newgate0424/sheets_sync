import { NextRequest, NextResponse } from 'next/server';
import { getMongoDb } from '@/lib/mongoDb';
import { ObjectId } from 'mongodb';
import { initializeCronJobs, isSchedulerRunning } from '@/lib/cronScheduler';

// GET - ดึง cron jobs ทั้งหมด
export async function GET() {
  try {
    // Auto-start scheduler ถ้ายังไม่ได้เริ่ม
    if (!isSchedulerRunning()) {
      console.log('[Cron API] Auto-starting scheduler...');
      // เริ่มใน background ไม่รอ
      initializeCronJobs().catch(err => 
        console.error('[Cron API] Failed to auto-start scheduler:', err)
      );
    }
    
    const db = await getMongoDb();
    const jobs = await db.collection('cron_jobs')
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    
    return NextResponse.json({ 
      jobs: jobs.map(j => ({ 
        ...j, 
        id: j._id.toString(),
        _id: undefined 
      }))
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - สร้าง cron job ใหม่
export async function POST(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { name, folder, table, schedule, customSchedule, startTime, endTime } = await request.json();
    
    if (!name || !folder || !table || !schedule) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const newJob = {
      name,
      folder,
      table,
      schedule,
      customSchedule: customSchedule || null,
      startTime: startTime || null,
      endTime: endTime || null,
      enabled: true,
      status: 'pending',
      lastRun: null,
      nextRun: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const result = await db.collection('cron_jobs').insertOne(newJob);
    
    // Reload cron scheduler
    try {
      const { reloadCronJobs } = await import('@/lib/cronScheduler');
      await reloadCronJobs();
    } catch (error) {
      console.log('Cron scheduler not available in development mode');
    }
    
    return NextResponse.json({ 
      success: true, 
      job: { ...newJob, id: result.insertedId.toString() }
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - อัพเดท cron job
export async function PUT(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { jobId, name, folder, table, schedule, customSchedule, startTime, endTime, enabled } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    const updateData: any = {
      updated_at: new Date()
    };
    
    if (name !== undefined) updateData.name = name;
    if (folder !== undefined) updateData.folder = folder;
    if (table !== undefined) updateData.table = table;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (customSchedule !== undefined) updateData.customSchedule = customSchedule;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (enabled !== undefined) {
      updateData.enabled = enabled;
      
      // ถ้า disable job ที่กำลังรันอยู่ ให้ force stop
      if (enabled === false) {
        const currentJob = await db.collection('cron_jobs').findOne({ _id: new ObjectId(jobId) });
        if (currentJob?.status === 'running') {
          console.log(`[API] Force stopping running job: ${currentJob.name}`);
          updateData.status = 'failed';
          updateData.nextRun = null;
        }
      }
    }
    
    await db.collection('cron_jobs').updateOne(
      { _id: new ObjectId(jobId) },
      { $set: updateData }
    );
    
    // Reload cron scheduler
    try {
      const { reloadCronJobs } = await import('@/lib/cronScheduler');
      await reloadCronJobs();
    } catch (error) {
      console.log('Cron scheduler not available in development mode');
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบ cron job
export async function DELETE(request: NextRequest) {
  try {
    const db = await getMongoDb();
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    await db.collection('cron_jobs').deleteOne({ _id: new ObjectId(jobId) });
    
    // Stop and reload cron scheduler
    try {
      const { stopCronJob, reloadCronJobs } = await import('@/lib/cronScheduler');
      stopCronJob(jobId);
      await reloadCronJobs();
    } catch (error) {
      console.log('Cron scheduler not available in development mode');
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
