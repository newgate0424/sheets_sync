import { NextApiRequest, NextApiResponse } from 'next';
import googleSheetsService from '@/lib/googleSheetsService';
import { mockGoogleStatus } from '@/lib/mockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'GET':
        try {
          const status = googleSheetsService.getAuthenticationStatus();
          return res.status(200).json(status);
        } catch (error) {
          console.error('Google API error, using mock data:', error);
          return res.status(200).json(mockGoogleStatus);
        }

      case 'POST':
        // Test API access with a sample sheet
        const { sheet_url } = req.body;
        
        if (!sheet_url) {
          return res.status(400).json({ error: 'Sheet URL is required' });
        }

        try {
          // ลองดึงข้อมูลจริง
          const sheetNames = await googleSheetsService.getSheetNames(sheet_url);
          const sampleData = await googleSheetsService.getSheetData(sheet_url, sheetNames[0], 'A1:Z5');
          
          return res.status(200).json({
            success: true,
            sheets: sheetNames,
            sampleData: sampleData,
            message: 'Successfully connected to Google Sheets'
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: (error as Error).message,
            message: 'Failed to connect to Google Sheets'
          });
        }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Google status API error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}