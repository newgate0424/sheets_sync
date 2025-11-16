import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ถ้าเป็น API routes ให้ผ่าน
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // ตรวจสอบ session cookie
  const sessionCookie = request.cookies.get('session');
  const isAuthenticated = !!sessionCookie;

  // หน้า login
  if (pathname === '/login') {
    // ถ้า login แล้วให้ไปหน้า database
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/database', request.url));
    }
    return NextResponse.next();
  }

  // หน้าที่ต้อง login
  const protectedPaths = ['/database', '/log', '/users'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // หน้า users เฉพาะ admin
  if (pathname.startsWith('/users')) {
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie.value);
        if (session.role !== 'admin') {
          return NextResponse.redirect(new URL('/database', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  // หน้าแรก redirect ไป login หรือ database
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/database', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/database/:path*',
    '/log/:path*',
    '/users/:path*',
    '/login'
  ]
};
