'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (path: string) => {
    return pathname === path
  }

  const handleLogout = async () => {
    if (!confirm('ต้องการออกจากระบบหรือไม่?')) return
    
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('ออกจากระบบสำเร็จ')
      router.push('/login')
      router.refresh()
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <nav className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">📊</span>
            <span className="font-semibold text-xl text-gray-800">Google Sheets Sync</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-2">
            <Link
              href="/dashboard"
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isActive('/dashboard')
                  ? 'bg-gray-800 bg-opacity-10 font-semibold'
                  : 'text-gray-700 hover:bg-gray-800 hover:bg-opacity-5'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/config"
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isActive('/config')
                  ? 'bg-gray-800 bg-opacity-10 font-semibold'
                  : 'text-gray-700 hover:bg-gray-800 hover:bg-opacity-5'
              }`}
            >
              ตั้งค่าชีต
            </Link>

            <Link
              href="/tables"
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isActive('/tables')
                  ? 'bg-gray-800 bg-opacity-10 font-semibold'
                  : 'text-gray-700 hover:bg-gray-800 hover:bg-opacity-5'
              }`}
            >
              ดูข้อมูล
            </Link>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="ml-4 px-4 py-2 rounded-lg font-medium text-white transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
            >
              {loggingOut ? 'กำลังออก...' : '🚪 ออกจากระบบ'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
