import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import NavbarWrapper from '@/components/NavbarWrapper'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Google Sheets to MySQL Sync',
  description: 'ระบบซิงค์ข้อมูลจาก Google Sheets ไปยัง MySQL Database',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={inter.className}>
        <NavbarWrapper />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
