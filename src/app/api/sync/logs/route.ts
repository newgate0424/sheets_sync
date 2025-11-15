import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    const logs = await prisma.syncLog.findMany({
      where: { configId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(logs)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
