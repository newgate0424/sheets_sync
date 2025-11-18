import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/googleSheets';

// POST - ดึงข้อมูลจาก sheet เพื่อดู schema
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { spreadsheetId, sheetName } = await request.json();
    
    if (!spreadsheetId || !sheetName) {
      return NextResponse.json({ error: 'Spreadsheet ID and sheet name are required' }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    
    // ดึงข้อมูลจาก sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ1000`, // ดึง 1000 แถวแรก
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    // แถวแรกเป็น header
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // สร้าง schema โดยวิเคราะห์ชนิดข้อมูล
    const schema = headers.map((header: string, index: number) => {
      const columnData = dataRows.map(row => row[index]).filter(val => val !== undefined && val !== '');
      
      let dataType = 'VARCHAR(255)';
      
      if (columnData.length > 0) {
        const allNumbers = columnData.every(val => !isNaN(Number(val)));
        const allIntegers = columnData.every(val => Number.isInteger(Number(val)));
        const allDates = columnData.every(val => !isNaN(Date.parse(val)));
        
        if (allNumbers) {
          dataType = allIntegers ? 'INT' : 'DECIMAL(10,2)';
        } else if (allDates) {
          dataType = 'DATETIME';
        } else {
          const maxLength = Math.max(...columnData.map(val => String(val).length));
          if (maxLength > 255) {
            dataType = 'TEXT';
          }
        }
      }
      
      return {
        name: header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        originalName: header,
        type: dataType,
        nullable: true
      };
    });

    return NextResponse.json({
      headers,
      schema,
      previewData: dataRows.slice(0, 5) // ส่งข้อมูล preview 5 แถวแรก
    });
  } catch (error: any) {
    console.error('Google Sheets error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
