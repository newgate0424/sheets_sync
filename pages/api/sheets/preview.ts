
// pages/api/sheets/preview.ts
import { NextApiRequest, NextApiResponse } from 'next';
import googleSheetsService from '@/lib/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Preview API called with:', req.body);
  
  try {
    switch (req.method) {
      case 'POST':
        const { sheet_url, sheet_name, range = 'A1:Z10' } = req.body;
        
        if (!sheet_url || !sheet_name) {
          return res.status(400).json({ error: 'Sheet URL and name are required' });
        }

        console.log('Fetching preview data for:', { sheet_url, sheet_name, range });

        // Get preview data
        const data = await googleSheetsService.getSheetData(sheet_url, sheet_name, range);
        
        console.log('Preview data fetched:', data);
        console.log('Data length:', data.length);
        console.log('Headers:', data[0]);
        
        return res.status(200).json({ 
          data,
          message: `Found ${data.length} rows with ${data[0]?.length || 0} columns`
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sheets preview API error:', error);
    return res.status(500).json({ 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}