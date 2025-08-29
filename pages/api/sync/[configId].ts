// pages/api/sync/[configId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import syncService from '@/lib/syncService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { configId } = req.query;

  try {
    switch (req.method) {
      case 'POST':
        const configIdNum = Number(configId);
        if (isNaN(configIdNum)) {
          return res.status(400).json({ error: 'Invalid config ID' });
        }

        // Check for sync type and options
        const { smartMode = false, fullSync = false } = req.body;
        
        let result;
        
        if (fullSync) {
          // Full Sync: ลบข้อมูลเก่าทั้งหมดแล้วเพิ่มใหม่
          console.log('🔄 Performing FULL SYNC - database will exactly match Google Sheets');
          result = await syncService.fullSync(configIdNum);
        } else {
          // Incremental Sync: เปรียบเทียบและ sync เฉพาะที่เปลี่ยนแปลง
          console.log('⚡ Performing INCREMENTAL SYNC - only changes will be applied');
          result = await syncService.syncData(configIdNum, smartMode);
        }
        
        return res.status(200).json({
          success: result.success,
          message: result.message,
          rowsSynced: result.rowsSynced,
          syncType: fullSync ? 'full' : (smartMode ? 'incremental-smart' : 'incremental-standard')
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    
    return res.status(500).json({ 
      success: false,
      error: (error as Error).message,
      rowsSynced: 0
    });
  }
}