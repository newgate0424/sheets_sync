import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    console.log('Executing query:', query);
    
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query(query);
      connection.release();
      
      return NextResponse.json({ rows });
    } catch (queryError: any) {
      connection.release();
      console.error('Query error:', queryError.message, 'Query:', query);
      return NextResponse.json({ error: queryError.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Query execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
