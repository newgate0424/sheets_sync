import { google } from 'googleapis';

export interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  columns: { [key: string]: string };
  is_active: boolean;
  last_sync_at?: Date;
  row_count: number;
}

export interface ColumnMapping {
  googleColumn: string;
  mysqlColumn: string;
  dataType: 'VARCHAR(255)' | 'INT' | 'TEXT' | 'DECIMAL(10,2)' | 'DATE' | 'DATETIME' | 'TIMESTAMP';
}

class GoogleSheetsService {
  private sheets;
  private apiKey: string = '';
  private useApiKey = false;

  constructor() {
    // ลองใช้ API Key ก่อน (ง่ายกว่า Service Account)
    if (process.env.GOOGLE_API_KEY) {
      this.apiKey = process.env.GOOGLE_API_KEY;
      this.sheets = google.sheets({ 
        version: 'v4', 
        auth: process.env.GOOGLE_API_KEY 
      });
      this.useApiKey = true;
      console.log('Using Google API Key authentication');
    } 
    // ถ้าไม่มี API Key ใช้ Service Account
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_CONTENT) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_CONTENT ? 
            JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_CONTENT) : undefined,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        this.sheets = google.sheets({ version: 'v4', auth });
        console.log('Using Service Account authentication');
      } catch (error) {
        console.error('Service Account setup error:', error);
      }
    }
    
    if (!this.sheets) {
      console.warn('Google Sheets API not configured - will use mock data');
    }
  }

  // ดึง Sheet ID จาก URL
  extractSheetId(url: string): string {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL');
    }
    return match[1];
  }

  // ตรวจสอบว่า Sheet เป็น Public หรือไม่
  async testSheetAccess(sheetUrl: string): Promise<boolean> {
    try {
      const sheetId = this.extractSheetId(sheetUrl);
      
      // ลองเรียก API แบบง่ายๆ
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${this.apiKey || 'test'}`
      );
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // ดึงข้อมูลจาก Google Sheets (แบบ Public API)
  async getSheetDataPublic(sheetUrl: string, sheetName: string, range?: string): Promise<any[][]> {
    try {
      const sheetId = this.extractSheetId(sheetUrl);
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      
      let url;
      
      if (this.apiKey) {
        // ใช้ API Key
        url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(fullRange)}?key=${this.apiKey}`;
      } else {
        // ใช้ CSV export (สำหรับ public sheets)
        url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      }

      console.log('Fetching data from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (this.apiKey) {
        // API response
        const data = await response.json();
        return data.values || [];
      } else {
        // CSV response
        const csvText = await response.text();
        return this.parseCSV(csvText);
      }
      
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      console.log('Falling back to mock data');
      return this.getMockData();
    }
  }

  // ดึงข้อมูลจาก Google Sheets (ใช้ API)
  async getSheetData(sheetUrl: string, sheetName: string, range?: string): Promise<any[][]> {
    // ลองใช้ Public API ก่อน
    if (this.apiKey || !this.sheets) {
      return this.getSheetDataPublic(sheetUrl, sheetName, range);
    }

    try {
      const sheetId = this.extractSheetId(sheetUrl);
      const fullRange = range ? `${sheetName}!${range}` : sheetName;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: fullRange,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching sheet data with service account:', error);
      
      // Fallback to public API
      return this.getSheetDataPublic(sheetUrl, sheetName, range);
    }
  }

  // ดึงชื่อ sheets ทั้งหมด
  async getSheetNames(sheetUrl: string): Promise<string[]> {
    try {
      const sheetId = this.extractSheetId(sheetUrl);
      
      let url;
      if (this.apiKey) {
        url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${this.apiKey}`;
      } else {
        // ลองใช้ Service Account
        if (this.sheets) {
          const response = await this.sheets.spreadsheets.get({
            spreadsheetId: sheetId,
          });
          return response.data.sheets?.map(sheet => sheet.properties?.title || '') || [];
        } else {
          throw new Error('No authentication method available');
        }
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.sheets?.map((sheet: any) => sheet.properties?.title || '') || [];
      
    } catch (error) {
      console.error('Error fetching sheet names:', error);
      console.log('Returning default sheet names');
      
      // ลองหาชื่อ sheets จากข้อมูลจริง
      try {
        const data = await this.getSheetData(sheetUrl, 'Sheet1', 'A1:A1');
        if (data.length > 0) {
          return ['Sheet1'];
        }
      } catch {}
      
      return ['Sheet1', 'Sheet2', 'Sheet3'];
    }
  }

  // แปลง CSV เป็น array
  private parseCSV(csvText: string): any[][] {
    const lines = csvText.split('\n');
    const result: any[][] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Simple CSV parsing (handles basic cases)
        const row = line.split(',').map(cell => 
          cell.replace(/^"|"$/g, '').replace(/""/g, '"')
        );
        result.push(row);
      }
    }
    
    return result;
  }

  // Mock Data สำหรับทดสอบ
  private getMockData(): any[][] {
    return [
      ['Name', 'Email', 'Age', 'City', 'Salary'],
      ['John Doe', 'john@example.com', '30', 'Bangkok', '50000'],
      ['Jane Smith', 'jane@example.com', '25', 'Chiang Mai', '45000'],
      ['Bob Johnson', 'bob@example.com', '35', 'Phuket', '55000'],
      ['Alice Brown', 'alice@example.com', '28', 'Pattaya', '48000'],
      ['Charlie Wilson', 'charlie@example.com', '32', 'Krabi', '52000']
    ];
  }

  // ตรวจสอบการเปลี่ยนแปลงข้อมูล
  async hasDataChanged(sheetUrl: string, sheetName: string, lastRowCount: number): Promise<boolean> {
    try {
      const data = await this.getSheetData(sheetUrl, sheetName);
      return data.length !== lastRowCount;
    } catch (error) {
      console.error('Error checking data changes:', error);
      return false;
    }
  }

  // แปลงข้อมูล Google Sheets เป็นรูปแบบสำหรับ MySQL
  transformDataForMySQL(data: any[][], columnMappings: ColumnMapping[]): any[] {
    if (data.length === 0) {
      console.log('No data to transform');
      return [];
    }

    const headers = data[0];
    const rows = data.slice(1);

    console.log('Headers found:', headers);
    console.log('Column mappings:', columnMappings);
    console.log('Data rows:', rows.length);

    const transformedRows = rows.map((row, rowIndex) => {
      const transformedRow: any = {};
      
      columnMappings.forEach((mapping, mappingIndex) => {
        const columnIndex = headers.indexOf(mapping.googleColumn);
        
        console.log(`Mapping ${mappingIndex}: "${mapping.googleColumn}" -> "${mapping.mysqlColumn}"`);
        console.log(`Column index: ${columnIndex}`);
        
        if (columnIndex !== -1 && columnIndex < row.length) {
          let value = row[columnIndex];
          
          // ถ้าเป็นค่าว่าง หรือ undefined ให้เป็น null
          if (value === undefined || value === '' || value === null) {
            value = null;
          } else {
            // แปลงข้อมูลตาม data type
            switch (mapping.dataType) {
              case 'INT':
                const intValue = parseInt(String(value));
                value = isNaN(intValue) ? null : intValue;
                break;
              case 'DECIMAL(10,2)':
                const floatValue = parseFloat(String(value));
                value = isNaN(floatValue) ? null : floatValue;
                break;
              case 'DATETIME':
                try {
                  value = value ? new Date(String(value)) : null;
                  // ถ้า date ไม่ถูกต้อง
                  if (value && isNaN(value.getTime())) {
                    value = null;
                  }
                } catch {
                  value = null;
                }
                break;
              default:
                // VARCHAR, TEXT - ใช้ string
                value = String(value).trim();
                if (value === '') value = null;
            }
          }
          
          transformedRow[mapping.mysqlColumn] = value;
          console.log(`Row ${rowIndex}, "${mapping.mysqlColumn}": ${value}`);
        } else {
          // ถ้าไม่พบ column ให้เป็น null
          transformedRow[mapping.mysqlColumn] = null;
          console.log(`Row ${rowIndex}, "${mapping.mysqlColumn}": null (column not found)`);
        }
      });
      
      return transformedRow;
    });

    console.log('Transformed data sample:', transformedRows[0]);
    return transformedRows;
  }

  // ตรวจสอบสถานะการตั้งค่า
  getAuthenticationStatus(): { method: string; configured: boolean } {
    if (this.apiKey) {
      return { method: 'API Key', configured: true };
    } else if (this.sheets) {
      return { method: 'Service Account', configured: true };
    } else {
      return { method: 'Mock Data', configured: false };
    }
  }

  // แปลงข้อมูลให้เป็น string และจัดการวันที่
  convertCellValue(value: any, dataType?: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    // แปลงเป็น string ก่อนเสมอ
    let stringValue = String(value).trim();

    // ถ้าเป็นข้อมูลว่าง
    if (!stringValue) {
      return '';
    }

    // ถ้าเป็นประเภทวันที่ ให้แปลงรูปแบบ
    if (dataType && (dataType.includes('DATE') || dataType.includes('TIMESTAMP'))) {
      return this.convertDateFormat(stringValue);
    }

    return stringValue;
  }

  // แปลงรูปแบบวันที่จาก dd/mm/yyyy หรือ dd-mm-yyyy เป็น yyyy-mm-dd
  // รองรับทั้ง date และ datetime
  private convertDateFormat(dateString: string): string {
    if (!dateString || dateString.trim() === '') {
      return '';
    }

    // ลบ whitespace
    const cleanDate = dateString.trim();

    try {
      // แยกส่วน date และ time (ถ้ามี)
      const parts = cleanDate.split(' ');
      const datePart = parts[0];
      const timePart = parts.length > 1 ? parts.slice(1).join(' ') : '';

      // รูปแบบ dd/mm/yyyy หรือ dd-mm-yyyy
      const patterns = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // dd/mm/yyyy หรือ dd-mm-yyyy
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // yyyy/mm/dd หรือ yyyy-mm-dd (รองรับ)
      ];

      // ลองรูปแบบ dd/mm/yyyy หรือ dd-mm-yyyy
      const match1 = datePart.match(patterns[0]);
      if (match1) {
        const day = match1[1].padStart(2, '0');
        const month = match1[2].padStart(2, '0');
        const year = match1[3];
        
        // ตรวจสอบความถูกต้องของวันที่
        const testDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (testDate.getFullYear() == parseInt(year) && 
            testDate.getMonth() == parseInt(month) - 1 && 
            testDate.getDate() == parseInt(day)) {
          const convertedDate = `${year}-${month}-${day}`;
          return timePart ? `${convertedDate} ${timePart}` : convertedDate;
        }
      }

      // ลองรูปแบบ yyyy/mm/dd หรือ yyyy-mm-dd
      const match2 = datePart.match(patterns[1]);
      if (match2) {
        const year = match2[1];
        const month = match2[2].padStart(2, '0');
        const day = match2[3].padStart(2, '0');
        
        // ตรวจสอบความถูกต้องของวันที่
        const testDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (testDate.getFullYear() == parseInt(year) && 
            testDate.getMonth() == parseInt(month) - 1 && 
            testDate.getDate() == parseInt(day)) {
          const convertedDate = `${year}-${month}-${day}`;
          return timePart ? `${convertedDate} ${timePart}` : convertedDate;
        }
      }

      // ลองใช้ Date constructor ดู (สำหรับรูปแบบอื่นๆ)
      const dateObj = new Date(datePart);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const convertedDate = `${year}-${month}-${day}`;
        return timePart ? `${convertedDate} ${timePart}` : convertedDate;
      }

      console.warn(`Cannot parse date format: ${dateString}, keeping original value`);
      return cleanDate; // ส่งกลับค่าเดิมถ้าแปลงไม่ได้
    } catch (error) {
      console.error(`Error parsing date ${dateString}:`, error);
      return cleanDate; // ส่งกลับค่าเดิมถ้าเกิดข้อผิดพลาด
    }
  }

  // แปลงข้อมูล row ทั้งหมด
  convertRowData(rowData: any[], columnMappings: { [key: string]: string }): { [key: string]: string } {
    const convertedData: { [key: string]: string } = {};
    
    Object.keys(columnMappings).forEach((googleColumn, index) => {
      const mysqlColumn = columnMappings[googleColumn];
      const rawValue = rowData[index];
      
      // แปลงค่าตามประเภทข้อมูล
      convertedData[mysqlColumn] = this.convertCellValue(rawValue, mysqlColumn);
    });

    return convertedData;
  }
}

export default new GoogleSheetsService();