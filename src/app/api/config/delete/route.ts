import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import mysql from 'mysql2/promise'

export async function DELETE(request: NextRequest) {
  try {
    const { configId } = await request.json()

    if (!configId) {
      return NextResponse.json(
        { error: 'Config ID is required' },
        { status: 400 }
      )
    }

    // ดึงข้อมูล config
    const config = await prisma.sheetConfig.findUnique({
      where: { id: configId },
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // สร้าง MySQL connection
    const dbUrl = process.env.DATABASE_URL!
    const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
    
    if (!match) {
      throw new Error('Invalid DATABASE_URL format')
    }

    const [, user, password, host, port, database] = match
    const conn = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database,
    })

    try {
      // ลบตารางข้อมูล
      await conn.execute(`DROP TABLE IF EXISTS \`${config.tableName}\``)
    } catch (error) {
      console.error('Error dropping table:', error)
    } finally {
      await conn.end()
    }

    // ลบ checksums
    await prisma.rowChecksum.deleteMany({
      where: { tableName: config.tableName },
    })

    // ลบ sync logs
    await prisma.syncLog.deleteMany({
      where: { configId },
    })

    // ลบ config
    await prisma.sheetConfig.delete({
      where: { id: configId },
    })

    return NextResponse.json({ 
      success: true,
      message: 'ลบตารางเรียบร้อยแล้ว'
    })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
