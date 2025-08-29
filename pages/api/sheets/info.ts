// pages/api/sheets/info.ts
import { NextApiRequest, NextApiResponse } from 'next';
import googleSheetsService from '@/lib/googleSheetsService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        const { sheet_url } = req.body;
        
        if (!sheet_url) {
          return res.status(400).json({ error: 'Sheet URL is required' });
        }

        // Get sheet names
        const sheetNames = await googleSheetsService.getSheetNames(sheet_url);
        
        return res.status(200).json({ sheets: sheetNames });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sheets info API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}