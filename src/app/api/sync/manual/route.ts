import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { syncService } from '@/lib/sync'

export async function POST(request: NextRequest) {
  try {
    const { configId, forceSync } = await request.json()

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    const result = await syncService.syncData(configId, forceSync || false)

    // Force Next.js to revalidate dashboard and stats
    revalidatePath('/dashboard')
    revalidatePath('/api/stats')

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
