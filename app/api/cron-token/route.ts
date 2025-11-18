import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.CRON_SYNC_TOKEN || 'your-secret-token-here-change-this';
  return NextResponse.json({ token });
}
