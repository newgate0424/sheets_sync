import pool from './db';
import incrementalSyncService from './incrementalSyncService';

interface PollJob {
  configId: number;
  interval: number; // seconds
  isRunning: boolean;
  lastRun?: Date;
  timeoutId?: NodeJS.Timeout;
}

class RealtimeSyncManager {
  private jobs: Map<number, PollJob> = new Map();
  private defaultInterval = 120; // 120 seconds (2 minutes) default

  constructor() {
    this.initialize();
  }

  async initialize() {
    console.log('Initializing real-time sync manager...');
    await this.startActiveJobs();
  }

  // เริ่มงาน polling สำหรับ configs ที่ active
  async startActiveJobs() {
    try {
      const [configs] = await pool.execute(`
        SELECT id, name FROM sync_configs WHERE is_active = 1
      `);

      for (const config of (configs as any[])) {
        await this.startJob(config.id, this.defaultInterval);
      }

      console.log(`Started ${(configs as any[]).length} sync jobs`);
    } catch (error) {
      console.error('Error starting active jobs:', error);
    }
  }

  // เริ่มงาน polling สำหรับ config เฉพาะ
  async startJob(configId: number, intervalSeconds: number = this.defaultInterval) {
    // หยุดงานเดิมก่อน (ถ้ามี)
    this.stopJob(configId);

    const job: PollJob = {
      configId,
      interval: intervalSeconds,
      isRunning: true
    };

    // ฟังก์ชัน polling
    const poll = async () => {
      if (!job.isRunning) return;

      try {
        console.log(`[${new Date().toISOString()}] Polling config ${configId}...`);
        job.lastRun = new Date();
        
        const result = await incrementalSyncService.incrementalSync(configId);
        
        if (result.success) {
          const { stats } = result;
          const changes = stats.insertedRows + stats.updatedRows + stats.deletedRows;
          
          if (changes > 0) {
            console.log(`[Config ${configId}] Changes detected: +${stats.insertedRows} ~${stats.updatedRows} -${stats.deletedRows}`);
          } else {
            console.log(`[Config ${configId}] No changes detected (${stats.unchangedRows} unchanged)`);
          }
        } else {
          console.error(`[Config ${configId}] Sync failed:`, result.message);
        }
        
      } catch (error) {
        console.error(`[Config ${configId}] Polling error:`, error);
      }

      // กำหนดการ poll ครั้งถัดไป
      if (job.isRunning) {
        job.timeoutId = setTimeout(poll, job.interval * 1000);
      }
    };

    // เริ่ม poll ทันที
    job.timeoutId = setTimeout(poll, 1000); // รอ 1 วินาทีแล้วเริ่ม
    this.jobs.set(configId, job);

    console.log(`Started sync job for config ${configId} with interval ${intervalSeconds}s`);
  }

  // หยุดงาน polling สำหรับ config เฉพาะ
  stopJob(configId: number) {
    const job = this.jobs.get(configId);
    if (job) {
      job.isRunning = false;
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      this.jobs.delete(configId);
      console.log(`Stopped sync job for config ${configId}`);
    }
  }

  // อัปเดตความถี่การ polling
  async updateJobInterval(configId: number, intervalSeconds: number) {
    const job = this.jobs.get(configId);
    if (job) {
      job.interval = intervalSeconds;
      // รีสตาร์ทงานด้วยความถี่ใหม่
      await this.startJob(configId, intervalSeconds);
      console.log(`Updated sync job interval for config ${configId} to ${intervalSeconds}s`);
    }
  }

  // ดูสถานะงาน polling ทั้งหมด
  getJobsStatus() {
    const status: any[] = [];
    
    for (const [configId, job] of this.jobs) {
      status.push({
        configId,
        isRunning: job.isRunning,
        interval: job.interval,
        lastRun: job.lastRun,
        nextRun: job.lastRun ? new Date(job.lastRun.getTime() + (job.interval * 1000)) : null
      });
    }
    
    return status;
  }

  // หยุดงานทั้งหมด
  stopAllJobs() {
    console.log('Stopping all sync jobs...');
    for (const configId of this.jobs.keys()) {
      this.stopJob(configId);
    }
  }

  // รีสตาร์ทงานตาม config ที่ active
  async restartActiveJobs() {
    this.stopAllJobs();
    await this.startActiveJobs();
  }

  // ทริกเกอร์ sync ทันทีสำหรับ config เฉพาะ (นอกเหนือจาก polling)
  async triggerImmediateSync(configId: number) {
    try {
      console.log(`Triggering immediate sync for config ${configId}...`);
      const result = await incrementalSyncService.incrementalSync(configId);
      return result;
    } catch (error) {
      console.error(`Error in immediate sync for config ${configId}:`, error);
      throw error;
    }
  }

  // ตั้งค่าความถี่การ polling แบบ adaptive (เร็วขึ้นถ้ามีการเปลี่ยนแปลงบ่อย)
  async enableAdaptivePolling(configId: number, baseInterval: number = 30, fastInterval: number = 5) {
    const job = this.jobs.get(configId);
    if (!job) return;

    // ติดตาม pattern การเปลี่ยนแปลง
    let changeHistory: boolean[] = [];
    
    const adaptivePoll = async () => {
      if (!job.isRunning) return;

      try {
        job.lastRun = new Date();
        const result = await incrementalSyncService.incrementalSync(configId);
        
        if (result.success) {
          const hasChanges = (result.stats.insertedRows + result.stats.updatedRows + result.stats.deletedRows) > 0;
          
          // เก็บประวัติการเปลี่ยนแปลง (เก็บ 10 ครั้งล่าสุด)
          changeHistory.push(hasChanges);
          if (changeHistory.length > 10) {
            changeHistory.shift();
          }
          
          // ปรับความถี่ตามการเปลี่ยนแปลง
          const recentChanges = changeHistory.slice(-3).filter(Boolean).length;
          const nextInterval = recentChanges >= 2 ? fastInterval : baseInterval;
          
          if (hasChanges) {
            console.log(`[Config ${configId}] Changes detected, next poll in ${nextInterval}s`);
          }
          
          job.interval = nextInterval;
        }
        
      } catch (error) {
        console.error(`[Config ${configId}] Adaptive polling error:`, error);
      }

      if (job.isRunning) {
        job.timeoutId = setTimeout(adaptivePoll, job.interval * 1000);
      }
    };

    // รีเซ็ตงานด้วย adaptive polling
    this.stopJob(configId);
    job.isRunning = true;
    job.timeoutId = setTimeout(adaptivePoll, 1000);
    this.jobs.set(configId, job);
    
    console.log(`Enabled adaptive polling for config ${configId} (base: ${baseInterval}s, fast: ${fastInterval}s)`);
  }
}

// สร้าง singleton instance
const realtimeSyncManager = new RealtimeSyncManager();

export default realtimeSyncManager;
