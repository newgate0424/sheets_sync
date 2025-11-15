'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function NavbarWrapper() {
  const pathname = usePathname()
  
  // ไม่แสดง Navbar ในหน้า login
  if (pathname === '/login') {
    return null
  }
  
  return <Navbar />
}
