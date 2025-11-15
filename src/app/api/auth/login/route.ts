import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // ดึง credentials จาก environment variables
    const validUsername = process.env.AUTH_USERNAME || 'admin'
    const validPassword = process.env.AUTH_PASSWORD || 'password'

    if (username === validUsername && password === validPassword) {
      // สร้าง response พร้อม set cookie
      const response = NextResponse.json({ 
        success: true,
        message: 'Login successful'
      })

      // ตั้ง session cookie (valid for 7 days)
      response.cookies.set('auth_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })

      return response
    } else {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
