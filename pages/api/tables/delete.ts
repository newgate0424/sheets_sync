// pages/api/tables/delete.ts
import { NextApiRequest, NextApiResponse } from 'next';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'DELETE':
        const { table_name } = req.body;
        
        if (!table_name) {
          return res.status(400).json({ error: 'Table name is required' });
        }

        // First check if table exists
        const checkTableQuery = `
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() 
          AND table_name = ?
        `;
        
        const [tableExists] = await db.execute(checkTableQuery, [table_name]) as any[];
        
        if (tableExists[0].count === 0) {
          return res.status(404).json({ error: `Table ${table_name} does not exist` });
        }

        // Drop the table
        const dropTableQuery = `DROP TABLE IF EXISTS \`${table_name.replace(/`/g, '``')}\``;
        await db.execute(dropTableQuery);

        // Also remove from sync_configs if it exists there
        const deleteConfigQuery = 'DELETE FROM sync_configs WHERE table_name = ?';
        await db.execute(deleteConfigQuery, [table_name]);
        
        return res.status(200).json({ 
          message: `Table ${table_name} deleted successfully`,
          table_name 
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Delete table API error:', error);
    return res.status(500).json({ 
      error: 'Failed to delete table',
      details: (error as Error).message 
    });
  }
}
