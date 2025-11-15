import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/folders - ดึงรายการ folders ทั้งหมด
export async function GET() {
  try {
    const configs = await prisma.sheetConfig.findMany({
      select: {
        folder: true,
      },
      distinct: ['folder'],
    })

    const folders = configs
      .map(c => c.folder || 'Default')
      .sort()

    // นับจำนวน configs ในแต่ละ folder
    const folderCounts = await Promise.all(
      folders.map(async (folder) => {
        const count = await prisma.sheetConfig.count({
          where: { folder },
        })
        return { folder, count }
      })
    )

    return NextResponse.json({
      success: true,
      folders: folderCounts,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
