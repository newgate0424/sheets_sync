import cron from 'node-cron';
import syncService from './syncService';
import smartDeltaSyncService from './smartDeltaSyncService';

class RealTimeSyncManager {
  private syncJobs: Map<number, cron.ScheduledTask> = new Map();
  private isInitialized = false;
  private pollingJobs: Map<number, NodeJS.Timeout> = new Map();
  private useSmartSync = true; // 🚀 Smart Auto-Pilot เป็นค่าเริ่มต้น

  // เริ่มระบบ real-time sync
  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Smart Auto-Pilot Sync Manager...');
    console.log(`🧠 Smart Delta Sync Mode: ${this.useSmartSync ? 'ENABLED' : 'DISABLED'}`);
    
    try {
      // ดึงการตั้งค่าทั้งหมดที่ active และสร้าง sync jobs
      const configs = await syncService.getAllSyncConfigs();
      
      // ตรวจสอบว่ามี config ที่ถูกต้องหรือไม่
      const validConfigs = configs.filter(config => {
        try {
          const columns = typeof config.columns === 'string' 
            ? JSON.parse(config.columns) 
            : config.columns;
          
          // ตรวจสอบว่า columns เป็น object ปกติ ไม่ใช่ string array
          if (typeof columns !== 'object' || Array.isArray(columns)) {
            console.warn(`Invalid columns format for config ${config.id}: ${config.name}`);
            return false;
          }

          // ตรวจสอบว่ามี key เป็นอักขระพิเศษหรือไม่
          const keys = Object.keys(columns);
          const hasInvalidKeys = keys.some(key => 
            key.includes('{') || key.includes('"') || key.includes(':') || 
            key.includes(',') || key.includes('}') || key.length < 2
          );

          if (hasInvalidKeys) {
            console.warn(`Invalid column keys for config ${config.id}: ${config.name}`, keys);
            return false;
          }

          return true;
        } catch (error) {
          console.warn(`Error validating config ${config.id}:`, error);
          return false;
        }
      });

      console.log(`Found ${configs.length} total configs, ${validConfigs.length} are valid`);

      if (validConfigs.length === 0) {
        console.log('No valid sync configurations found. Real-time sync will not start.');
        this.isInitialized = true;
        return;
      }

      for (const config of validConfigs) {
        this.startSyncJob(config.id, '30s'); // เปลี่ยนเป็นทุก 30 วินาที
      }

      this.isInitialized = true;
      console.log(`Started ${validConfigs.length} sync jobs`);
    } catch (error) {
      console.error('Error initializing real-time sync:', error);
      this.isInitialized = true; // Mark as initialized to prevent repeated attempts
    }
  }

  // เริ่ม sync job สำหรับ config เฉพาะ
  startSyncJob(configId: number, interval: string = '120s') { // เปลี่ยนจาก 30s เป็น 120s (2 นาที)
    // หยุด job เก่าถ้ามี
    this.stopSyncJob(configId);

    if (interval.endsWith('s')) {
      // ใช้ polling แทน cron สำหรับ interval เป็นวินาที
      const seconds = parseInt(interval.replace('s', ''));
      const pollingInterval = setInterval(async () => {
        await this.performSync(configId);
      }, seconds * 1000);

      this.pollingJobs.set(configId, pollingInterval);
      console.log(`Started polling sync job for config ${configId} with interval ${interval}`);
    } else {
      // ใช้ cron สำหรับ interval อื่นๆ
      const job = cron.schedule(interval, async () => {
        await this.performSync(configId);
      }, {
        scheduled: false
      });

      this.syncJobs.set(configId, job);
      job.start();
      console.log(`Started cron sync job for config ${configId} with interval ${interval}`);
    }
  }

  private async performSync(configId: number) {
    try {
      if (this.useSmartSync) {
        // 🧠 ใช้ Smart Delta Sync
        console.log(`[${new Date().toISOString()}] Polling config ${configId}...`);
        const result = await smartDeltaSyncService.smartSync(configId);
        
        if (result.success) {
          const stats = result.stats;
          if (stats.newRows > 0 || stats.changedRows > 0) {
            console.log(`[Config ${configId}] Smart sync completed: ${stats.newRows} new, ${stats.changedRows} changed, ${stats.unchangedRows} unchanged (${stats.performance.totalDuration}ms)`);
          } else {
            console.log(`[Config ${configId}] Smart sync - no changes detected (${stats.unchangedRows} unchanged)`);
          }
        } else {
          console.error(`[Config ${configId}] Smart sync error:`, result.message);
          // Fallback to standard sync if smart sync fails
          console.log(`[Config ${configId}] Falling back to standard sync...`);
          const fallbackResult = await syncService.syncData(configId);
          if (fallbackResult.success) {
            console.log(`[Config ${configId}] Fallback sync completed: ${fallbackResult.message}`);
          }
        }
      } else {
        // 📊 ใช้ Standard Incremental Sync
        console.log(`[${new Date().toISOString()}] Starting incremental sync for config ${configId}...`);
        const result = await syncService.syncData(configId);
        
        if (result.success && result.rowsSynced > 0) {
          console.log(`[Config ${configId}] Incremental sync completed: ${result.message} (${result.rowsSynced} rows affected)`);
        } else if (result.success) {
          console.log(`[Config ${configId}] Incremental sync - no changes detected`);
        }
        
        if (!result.success) {
          console.error(`Incremental sync error for config ${configId}:`, result.message);
        }
      }
    } catch (error) {
      console.error(`Error in sync job ${configId}:`, error);
      // Fallback ถ้า Smart Sync error
      if (this.useSmartSync) {
        try {
          console.log(`[Config ${configId}] Smart sync failed, trying standard sync...`);
          const fallbackResult = await syncService.syncData(configId);
          if (fallbackResult.success) {
            console.log(`[Config ${configId}] Fallback standard sync completed`);
          }
        } catch (fallbackError) {
          console.error(`[Config ${configId}] Both smart and standard sync failed:`, fallbackError);
        }
      }
    }
  }

  // 🧠 เปิด/ปิด Smart Delta Sync Mode
  enableSmartSync() {
    this.useSmartSync = true;
    console.log('🧠 Smart Delta Sync Mode: ENABLED for all real-time sync jobs');
  }

  disableSmartSync() {
    this.useSmartSync = false;
    console.log('📊 Smart Delta Sync Mode: DISABLED - using standard incremental sync');
  }

  isSmartSyncEnabled(): boolean {
    return this.useSmartSync;
  }

  // อัปเดตสถิติ Smart Sync
  getSmartSyncStats() {
    return {
      smartSyncEnabled: this.useSmartSync,
      activeSyncJobs: this.syncJobs.size + this.pollingJobs.size,
      cronJobs: this.syncJobs.size,
      pollingJobs: this.pollingJobs.size
    };
  }

  // หยุด sync job
  stopSyncJob(configId: number) {
    // หยุด cron job
    const cronJob = this.syncJobs.get(configId);
    if (cronJob) {
      cronJob.stop();
      this.syncJobs.delete(configId);
      console.log(`Stopped cron sync job for config ${configId}`);
    }

    // หยุด polling job
    const pollingJob = this.pollingJobs.get(configId);
    if (pollingJob) {
      clearInterval(pollingJob);
      this.pollingJobs.delete(configId);
      console.log(`Stopped polling sync job for config ${configId}`);
    }
  }

  // หยุด sync jobs ทั้งหมด
  stopAllJobs() {
    // หยุด cron jobs
    for (const [configId, job] of this.syncJobs) {
      job.stop();
    }
    this.syncJobs.clear();

    // หยุด polling jobs
    for (const [configId, job] of this.pollingJobs) {
      clearInterval(job);
    }
    this.pollingJobs.clear();

    console.log('Stopped all sync jobs');
  }

  // อัพเดท sync job (เมื่อมีการเปลี่ยนแปลงการตั้งค่า)
  updateSyncJob(configId: number, interval?: string) {
    this.startSyncJob(configId, interval || '30s');
  }

  // ตรวจสอบสถานะ jobs ที่กำลังทำงาน
  getActiveJobs(): { cronJobs: number[], pollingJobs: number[] } {
    return {
      cronJobs: Array.from(this.syncJobs.keys()),
      pollingJobs: Array.from(this.pollingJobs.keys())
    };
  }

  // Manual sync ทั้งหมด (สำหรับปุ่ม sync ใน dashboard)
  async syncAll() {
    console.log('Manual sync all triggered');
    const configs = await syncService.getAllSyncConfigs();
    
    const results = await Promise.allSettled(
      configs.map(config => syncService.syncData(config.id))
    );

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Manual sync failed for config ${configs[index].id}:`, 
          result.status === 'rejected' ? result.reason : result.value.message);
      }
    });

    console.log(`Manual sync completed: ${successCount} success, ${errorCount} errors`);
    return { success: successCount, errors: errorCount, total: configs.length };
  }

  // เริ่ม real-time sync สำหรับ config เฉพาะ
  async startRealTimeSync(configId: number) {
    this.startSyncJob(configId, '10s'); // ทุก 10 วินาทีสำหรับ real-time
    return { success: true, message: `Real-time sync started for config ${configId}` };
  }

  // หยุด real-time sync สำหรับ config เฉพาะ
  async stopRealTimeSync(configId: number) {
    this.stopSyncJob(configId);
    return { success: true, message: `Real-time sync stopped for config ${configId}` };
  }

  // ตรวจสอบสถานะ real-time sync
  getRealTimeSyncStatus() {
    const activeJobs = this.getActiveJobs();
    return {
      isActive: activeJobs.cronJobs.length > 0 || activeJobs.pollingJobs.length > 0,
      totalJobs: activeJobs.cronJobs.length + activeJobs.pollingJobs.length,
      cronJobs: activeJobs.cronJobs,
      pollingJobs: activeJobs.pollingJobs,
      isInitialized: this.isInitialized
    };
  }
}

export default new RealTimeSyncManager();