import { NextApiRequest, NextApiResponse } from 'next';
import incrementalSyncService from '@/lib/incrementalSyncService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        console.log('=== INCREMENTAL SYNC ALL ACTIVE CONFIGS ===');
        
        const results = await incrementalSyncService.syncAllIncremental();
        
        const totalStats = results.reduce((acc, result) => ({
          totalRows: acc.totalRows + result.stats.totalRows,
          insertedRows: acc.insertedRows + result.stats.insertedRows,
          updatedRows: acc.updatedRows + result.stats.updatedRows,
          deletedRows: acc.deletedRows + result.stats.deletedRows,
          unchangedRows: acc.unchangedRows + result.stats.unchangedRows,
        }), { totalRows: 0, insertedRows: 0, updatedRows: 0, deletedRows: 0, unchangedRows: 0 });
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        return res.status(200).json({
          success: failCount === 0,
          message: `Incremental sync completed: ${successCount} success, ${failCount} failed`,
          totalConfigs: results.length,
          successCount,
          failCount,
          totalStats,
          results,
          type: 'incremental'
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Incremental sync all API error:', error);
    return res.status(500).json({ 
      success: false,
      error: (error as Error).message,
      type: 'incremental'
    });
  }
}
