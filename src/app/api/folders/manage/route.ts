import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

// PUT /api/folders/move - ย้าย config ไป folder ใหม่
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { configId, folder } = body

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'Missing configId' },
        { status: 400 }
      )
    }

    await prisma.sheetConfig.update({
      where: { id: configId },
      data: { folder: folder || 'Default' },
    })

    // Force Next.js to revalidate dashboard and stats
    revalidatePath('/dashboard')
    revalidatePath('/api/stats')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/folders/rename - เปลี่ยนชื่อ folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { oldName, newName } = body

    if (!oldName || !newName) {
      return NextResponse.json(
        { success: false, error: 'Missing oldName or newName' },
        { status: 400 }
      )
    }

    // อัปเดตทุก config ที่อยู่ใน folder เก่า
    await prisma.sheetConfig.updateMany({
      where: { folder: oldName },
      data: { folder: newName },
    })

    // Force Next.js to revalidate dashboard and stats
    revalidatePath('/dashboard')
    revalidatePath('/api/stats')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
