import { NextRequest, NextResponse } from 'next/server';
import { initializeCronJobs, reloadCronJobs } from '@/lib/cronScheduler';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET - เริ่ม/รีโหลด cron scheduler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'reload';
    
    if (action === 'reload') {
      await reloadCronJobs();
      return NextResponse.json({ success: true, message: 'Cron jobs reloaded' });
    } else if (action === 'init') {
      await initializeCronJobs();
      return NextResponse.json({ success: true, message: 'Cron jobs initialized' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Cron scheduler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
