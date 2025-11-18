// Auto-initialize cron scheduler on server startup
import { initializeCronJobs } from './cronScheduler';

let isInitialized = false;

export async function autoInitializeCron() {
  if (isInitialized) {
    console.log('[Cron] Scheduler already initialized, skipping...');
    return;
  }

  try {
    console.log('[Cron] 🚀 Auto-starting scheduler on server startup...');
    await initializeCronJobs();
    isInitialized = true;
    console.log('[Cron] ✓ Scheduler started successfully');
  } catch (error) {
    console.error('[Cron] ✗ Failed to start scheduler:', error);
  }
}

// Initialize on module load (only in Node.js environment)
if (typeof window === 'undefined') {
  // Delay initialization to ensure MongoDB is ready
  setTimeout(() => {
    autoInitializeCron().catch(console.error);
  }, 2000);
}
