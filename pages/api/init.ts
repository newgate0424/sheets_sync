import { NextApiRequest, NextApiResponse } from 'next';
import { initDatabase } from '@/lib/db';
import realTimeSyncManager from '@/lib/realTimeSync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        // Initialize database and real-time sync
        await initDatabase();
        await realTimeSyncManager.initialize();
        
        return res.status(200).json({ 
          message: 'System initialized successfully',
          activeJobs: realTimeSyncManager.getActiveJobs()
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Initialization error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}