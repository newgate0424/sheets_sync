import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export async function getGoogleSheetsClient() {
  const credentialsPath = path.join(process.cwd(), 'credentials.json');
  
  // Check if credentials.json exists
  if (!fs.existsSync(credentialsPath)) {
    console.warn('⚠️  credentials.json not found. Google Sheets sync will not work.');
    console.warn('📋 Download from: https://console.cloud.google.com/apis/credentials');
    throw new Error('Google Sheets credentials not configured');
  }
  
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as any });
  
  return sheets;
}

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
