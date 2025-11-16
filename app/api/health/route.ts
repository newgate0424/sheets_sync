import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connection = await pool.getConnection();
    
    // ทดสอบ query ง่ายๆ
    const [result] = await connection.execute('SELECT 1 as status');
    connection.release();
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    
    let errorMessage = error.message;
    let suggestion = '';
    
    if (error.code === 'ECONNREFUSED') {
      suggestion = 'MySQL server is not accepting connections. Check if MySQL is running and firewall allows connections.';
    } else if (error.code === 'ETIMEDOUT') {
      suggestion = 'Connection timeout. The database server may be unreachable or behind a firewall.';
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      suggestion = 'Access denied. Check database credentials in environment variables.';
    } else if (error.code === 'ENOTFOUND') {
      suggestion = 'Database host not found. Check DB_HOST environment variable.';
    }
    
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: errorMessage,
      code: error.code,
      suggestion,
      host: process.env.DB_HOST || 'Not set',
      port: process.env.DB_PORT || 'Not set',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}
