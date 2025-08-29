// pages/api/tables/create.ts
import { NextApiRequest, NextApiResponse } from 'next';
import syncService from '@/lib/syncService';
import { ColumnMapping } from '@/lib/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        const { table_name, columns } = req.body;
        
        if (!table_name || !columns) {
          return res.status(400).json({ error: 'Table name and columns are required' });
        }

        const columnMappings: ColumnMapping[] = columns;
        await syncService.createMySQLTable(table_name, columnMappings);
        
        return res.status(201).json({ message: `Table ${table_name} created successfully` });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Create table API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}