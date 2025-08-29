import { NextApiRequest, NextApiResponse } from 'next';
import realtimeSyncManager from '@/lib/realtimeSyncManager';
import { mockRealtimeStatus } from '@/lib/mockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        try {
          // ดูสถานะ real-time sync jobs
          const status = realtimeSyncManager.getJobsStatus();
          return res.status(200).json({
            jobs: status,
            totalJobs: status.length,
            activeJobs: status.filter(job => job.isRunning).length
          });
        } catch (error) {
          console.error('Realtime sync error, using mock data:', error);
          return res.status(200).json(mockRealtimeStatus);
        }

      case 'POST':
        const { action, configId, interval } = req.body;

        switch (action) {
          case 'start':
            if (configId) {
              await realtimeSyncManager.startJob(configId, interval || 30);
              return res.status(200).json({ 
                message: `Started real-time sync for config ${configId}`,
                interval: interval || 30
              });
            } else {
              await realtimeSyncManager.restartActiveJobs();
              return res.status(200).json({ 
                message: 'Started real-time sync for all active configurations'
              });
            }

          case 'stop':
            if (configId) {
              realtimeSyncManager.stopJob(configId);
              return res.status(200).json({ 
                message: `Stopped real-time sync for config ${configId}`
              });
            } else {
              realtimeSyncManager.stopAllJobs();
              return res.status(200).json({ 
                message: 'Stopped all real-time sync jobs'
              });
            }

          case 'update':
            if (configId && interval) {
              await realtimeSyncManager.updateJobInterval(configId, interval);
              return res.status(200).json({ 
                message: `Updated sync interval for config ${configId} to ${interval}s`
              });
            } else {
              return res.status(400).json({ error: 'configId and interval are required for update action' });
            }

          case 'trigger':
            if (configId) {
              const result = await realtimeSyncManager.triggerImmediateSync(configId);
              return res.status(200).json({ 
                message: 'Immediate sync triggered',
                result
              });
            } else {
              return res.status(400).json({ error: 'configId is required for trigger action' });
            }

          case 'adaptive':
            if (configId) {
              await realtimeSyncManager.enableAdaptivePolling(
                configId, 
                req.body.baseInterval || 30,
                req.body.fastInterval || 5
              );
              return res.status(200).json({ 
                message: `Enabled adaptive polling for config ${configId}`
              });
            } else {
              return res.status(400).json({ error: 'configId is required for adaptive action' });
            }

          default:
            return res.status(400).json({ error: 'Invalid action. Use: start, stop, update, trigger, or adaptive' });
        }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Real-time sync API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: (error as Error).message 
    });
  }
}
