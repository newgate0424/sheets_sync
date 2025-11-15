import { NextRequest, NextResponse } from 'next/server'
import { syncService } from '@/lib/sync'

/**
 * Cron Job Endpoint
 * ใช้สำหรับเรียกจาก Cron Service เช่น cron-job.org หรือ easycron.com
 * รองรับทั้ง GET และ POST
 * ส่ง API Key ผ่าน query parameter: ?key=YOUR_API_KEY&configId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get('key')
    const configId = searchParams.get('configId')

    // ตรวจสอบ API Key
    if (apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    // รัน sync แบบ async (ไม่ต้องรอให้เสร็จ)
    syncService.syncData(configId).then(() => {
      console.log(`Sync completed for config: ${configId}`)
    }).catch((error) => {
      console.error(`Sync failed for config: ${configId}`, error)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Sync started',
      configId 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // รองรับ Authorization header (แบบเดิม)
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { configId } = await request.json()

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    // รัน sync แบบ async (ไม่ต้องรอให้เสร็จ)
    // เพื่อป้องกัน timeout ใน cron job
    syncService.syncData(configId).then(() => {
      console.log(`Sync completed for config: ${configId}`)
    }).catch((error) => {
      console.error(`Sync failed for config: ${configId}`, error)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Sync started',
      configId 
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
