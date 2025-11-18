import { NextRequest, NextResponse } from 'next/server';

// POST - Logout
// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
  
  // ลบ cookie
  response.cookies.delete('session');
  
  return response;
}
