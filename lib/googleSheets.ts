import { google } from 'googleapis';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'credentials.json'),
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
