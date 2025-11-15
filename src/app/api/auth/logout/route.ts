import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ 
    success: true,
    message: 'Logged out successfully'
  })

  // ลบ session cookie
  response.cookies.delete('auth_session')

  return response
}
