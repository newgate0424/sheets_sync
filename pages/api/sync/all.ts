// pages/api/sync/all.ts
import { NextApiRequest, NextApiResponse } from 'next';
import syncService from '@/lib/syncService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        console.log('=== SYNC ALL ACTIVE CONFIGS ===');
        
        const { fullSync = false, smartMode = false } = req.body;
        
        // Get all active configs
        const configs = await syncService.getAllSyncConfigs();
        console.log(`Found ${configs.length} active configurations`);
        
        if (configs.length === 0) {
          return res.status(200).json({ 
            message: 'No active configurations found',
            totalSynced: 0 
          });
        }
        
        let totalSynced = 0;
        const results = [];
        
        // Sync each config
        for (const config of configs) {
          console.log(`Syncing config: ${config.name} (${fullSync ? 'FULL' : 'INCREMENTAL'} SYNC)`);
          
          try {
            let result;
            
            if (fullSync) {
              result = await syncService.fullSync(config.id);
            } else {
              result = await syncService.syncData(config.id, smartMode);
            }
            
            totalSynced += result.rowsSynced || 0;
            results.push({
              configId: config.id,
              configName: config.name,
              success: result.success,
              rowsSynced: result.rowsSynced || 0,
              message: result.message,
              syncType: fullSync ? 'full' : 'incremental'
            });
          } catch (error) {
            console.error(`Error syncing config ${config.id}:`, error);
            results.push({
              configId: config.id,
              configName: config.name,
              success: false,
              error: (error as Error).message,
              syncType: fullSync ? 'full' : 'incremental'
            });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        console.log(`Sync all completed: ${successCount} success, ${failCount} failed, ${totalSynced} total rows`);
        
        return res.status(200).json({ 
          message: `Synced ${successCount} configurations successfully (${fullSync ? 'FULL' : 'INCREMENTAL'} sync)`,
          totalConfigs: configs.length,
          successCount,
          failCount,
          totalRowsSynced: totalSynced,
          syncType: fullSync ? 'full' : 'incremental',
          results
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync all API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}