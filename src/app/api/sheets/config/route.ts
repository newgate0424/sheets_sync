import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { syncService } from '@/lib/sync'

export async function GET() {
  try {
    const configs = await prisma.sheetConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(configs)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, spreadsheetId, sheetName, range, tableName, schema, folder } = body

    // Validation
    if (!name || !spreadsheetId || !sheetName || !tableName || !schema) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // ตรวจสอบว่า tableName ซ้ำหรือไม่
    const existing = await prisma.sheetConfig.findUnique({
      where: { tableName },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Table name already exists' },
        { status: 400 }
      )
    }

    // สร้าง Config
    const config = await prisma.sheetConfig.create({
      data: {
        name,
        spreadsheetId,
        sheetName,
        range: range || `${sheetName}!A:Z`,
        tableName,
        schema,
        folder: folder || 'Default',
      },
    })

    // สร้างตารางใน MySQL
    await syncService.createTable(tableName, schema)

    // Force Next.js to revalidate dashboard and stats
    revalidatePath('/dashboard')
    revalidatePath('/api/stats')

    return NextResponse.json(config)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    await prisma.sheetConfig.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
