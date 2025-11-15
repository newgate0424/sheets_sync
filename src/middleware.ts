import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ข้ามการตรวจสอบสำหรับ API routes, static files, และ login page
  const path = request.nextUrl.pathname
  
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/favicon.ico') ||
    path === '/login'
  ) {
    return NextResponse.next()
  }

  // ตรวจสอบ session cookie
  const session = request.cookies.get('auth_session')
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
