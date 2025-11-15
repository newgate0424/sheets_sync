import { NextRequest, NextResponse } from 'next/server'
import { syncService } from '@/lib/sync'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('tableName')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search') || ''
    const searchColumn = searchParams.get('searchColumn') || 'all'

    if (!tableName) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      )
    }

    const result = await syncService.getTableData(tableName, page, limit, search, searchColumn)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
