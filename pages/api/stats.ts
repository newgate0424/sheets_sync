import { NextApiRequest, NextApiResponse } from 'next';
import syncService from '@/lib/syncService';
import { mockStats, mockRecentLogs } from '@/lib/mockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        try {
          const stats = await syncService.getSyncStats();
          return res.status(200).json(stats);
        } catch (dbError) {
          console.error('Database error, using mock data:', dbError);
          return res.status(200).json({
            stats: mockStats,
            recentLogs: mockRecentLogs
          });
        }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Stats API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}