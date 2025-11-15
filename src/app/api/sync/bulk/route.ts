import { NextRequest, NextResponse } from 'next/server'
import { syncService } from '@/lib/sync'

interface SyncResult {
  configId: string
  success: boolean
  duration?: number
  rowsProcessed?: number
  rowsInserted?: number
  rowsUpdated?: number
  rowsDeleted?: number
  error?: string
}

// POST /api/sync/bulk - ซิงค์หลาย configs พร้อมกัน
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { configIds, folder } = body

    let targetConfigIds: string[] = []

    // ถ้าระบุ configIds มา ใช้เลย
    if (configIds && Array.isArray(configIds) && configIds.length > 0) {
      targetConfigIds = configIds
    }
    // ถ้าระบุ folder มา ดึง configs ทั้งหมดใน folder นั้น
    else if (folder) {
      const { prisma } = await import('@/lib/db')
      const configs = await prisma.sheetConfig.findMany({
        where: {
          folder,
          isActive: true,
        },
        select: { id: true },
      })
      targetConfigIds = configs.map(c => c.id)
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing configIds or folder' },
        { status: 400 }
      )
    }

    if (targetConfigIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No configs found to sync' },
        { status: 400 }
      )
    }

    // เริ่มซิงค์แบบ parallel (ไม่รอกัน)
    const startTime = Date.now()
    console.log(`🔄 Starting bulk sync for ${targetConfigIds.length} configs...`)

    // ใช้ Promise.allSettled เพื่อซิงค์พร้อมกันและรอให้เสร็จหมด
    const results = await Promise.allSettled(
      targetConfigIds.map(async (configId) => {
        const result = await syncService.syncData(configId)
        return {
          configId,
          ...result,
        }
      })
    )

    // รวบรวมผลลัพธ์
    const syncResults: SyncResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value as SyncResult
      } else {
        return {
          configId: targetConfigIds[index],
          success: false,
          error: result.reason?.message || 'Unknown error',
        }
      }
    })

    const totalDuration = Date.now() - startTime
    const successCount = syncResults.filter(r => r.success).length
    const failedCount = syncResults.length - successCount

    console.log(`✅ Bulk sync completed: ${successCount} success, ${failedCount} failed in ${(totalDuration/1000).toFixed(2)}s`)

    return NextResponse.json({
      success: true,
      totalConfigs: targetConfigIds.length,
      successCount,
      failedCount,
      totalDuration,
      results: syncResults,
    })
  } catch (error: any) {
    console.error('Bulk sync error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
