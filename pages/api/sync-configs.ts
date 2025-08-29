// pages/api/sync-configs.ts
import { NextApiRequest, NextApiResponse } from 'next';
import syncService from '@/lib/syncService';
import googleSheetsService from '@/lib/googleSheetsService';
import { mockConfigs } from '@/lib/mockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        try {
          const configs = await syncService.getAllSyncConfigs();
          return res.status(200).json(configs);
        } catch (dbError) {
          console.error('Database error, using mock data:', dbError);
          return res.status(200).json(mockConfigs);
        }

      case 'POST':
        const { name, sheet_url, sheet_name, table_name, columns, is_active = true } = req.body;
        
        // Validate required fields
        if (!name || !sheet_url || !sheet_name || !table_name || !columns) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const configId = await syncService.createSyncConfig({
          name,
          sheet_url,
          sheet_name,
          table_name,
          columns,
          is_active
        });

        return res.status(201).json({ id: configId, message: 'Sync configuration created successfully' });

      case 'DELETE':
        const { id } = req.query;
        
        if (!id || Array.isArray(id)) {
          return res.status(400).json({ error: 'Invalid config ID' });
        }

        const configIdToDelete = parseInt(id as string);
        if (isNaN(configIdToDelete)) {
          return res.status(400).json({ error: 'Config ID must be a number' });
        }

        await syncService.deleteSyncConfig(configIdToDelete);
        return res.status(200).json({ message: 'Sync configuration deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}