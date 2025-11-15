import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ - Google Sheets Sync',
  description: 'เข้าสู่ระบบเพื่อจัดการข้อมูล Google Sheets',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
