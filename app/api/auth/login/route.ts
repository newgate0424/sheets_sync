import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcrypt';

// POST - Login
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก username และ password' }, { status: 400 });
    }

    const connection = await pool.getConnection();

    // ค้นหา user
    const [users]: any = await connection.query(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    );

    connection.release();

    if (users.length === 0) {
      return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
    }

    const user = users[0];

    // ตรวจสอบ password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
    }

    // อัปเดต last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // สร้าง session (ใช้ cookie)
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });

    // ตั้งค่า cookie สำหรับ session
    response.cookies.set('session', JSON.stringify({
      userId: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 วัน
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
