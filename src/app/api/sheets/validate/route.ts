import { NextRequest, NextResponse } from 'next/server'
import { googleSheetsService } from '@/lib/google-sheets'

export async function POST(request: NextRequest) {
  try {
    const { spreadsheetId } = await request.json()

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    const result = await googleSheetsService.validateSpreadsheet(spreadsheetId)

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
