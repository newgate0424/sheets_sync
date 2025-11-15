import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import mysql from 'mysql2/promise'

async function getConnection() {
  const dbUrl = process.env.DATABASE_URL!
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  
  if (!match) {
    throw new Error('Invalid DATABASE_URL format')
  }

  const [, user, password, host, port, database] = match

  return await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
  })
}

export async function GET() {
  try {
    const configs = await prisma.sheetConfig.findMany({
      where: { isActive: true },
    })

    const conn = await getConnection()
    const stats = []

    for (const config of configs) {
      try {
        const [result] = await conn.execute(
          `SELECT COUNT(*) as count FROM \`${config.tableName}\``
        )
        const count = Array.isArray(result) && result.length > 0 
          ? (result[0] as any).count 
          : 0

        // ดึง log ล่าสุด
        const lastSync = await prisma.syncLog.findFirst({
          where: { configId: config.id },
          orderBy: { startedAt: 'desc' },
        })

        stats.push({
          id: config.id,
          name: config.name,
          tableName: config.tableName,
          rowCount: count,
          lastSyncedAt: lastSync?.completedAt,
          lastSyncStatus: lastSync?.status,
          folder: config.folder,
        })
      } catch (error) {
        console.error(`Error getting stats for ${config.tableName}:`, error)
      }
    }

    await conn.end()

    return NextResponse.json(stats)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
