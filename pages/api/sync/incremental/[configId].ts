import { NextApiRequest, NextApiResponse } from 'next';
import incrementalSyncService from '@/lib/incrementalSyncService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { configId } = req.query;

  try {
    switch (req.method) {
      case 'POST':
        console.log(`=== INCREMENTAL SYNC CONFIG ${configId} ===`);
        
        const configIdNum = Number(configId);
        if (isNaN(configIdNum)) {
          return res.status(400).json({ error: 'Invalid config ID' });
        }

        const result = await incrementalSyncService.incrementalSync(configIdNum);
        
        return res.status(200).json({
          success: result.success,
          message: result.message,
          stats: result.stats,
          type: 'incremental'
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Incremental sync API error:', error);
    return res.status(500).json({ 
      success: false,
      error: (error as Error).message,
      type: 'incremental'
    });
  }
}
