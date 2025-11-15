import { NextRequest, NextResponse } from 'next/server'
import { googleSheetsService } from '@/lib/google-sheets'

export async function POST(request: NextRequest) {
  try {
    const { spreadsheetId, sheetName } = await request.json()

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: 'Spreadsheet ID and Sheet Name are required' },
        { status: 400 }
      )
    }

    const result = await googleSheetsService.getSheetHeaders(spreadsheetId, sheetName)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
