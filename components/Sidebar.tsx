'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, FileText, Home, Settings, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

const menuItems = [
  { icon: Home, label: 'หน้าหลัก', href: '/' },
  { icon: Database, label: 'Database', href: '/database' },
  { icon: FileText, label: 'Logs', href: '/log' },
  { icon: Settings, label: 'ตั้งค่า', href: '/settings' },
];

export default function Sidebar({ isOpen, onClose, collapsed = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay - แสดงเฉพาะ mobile เมื่อเปิด */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg z-30 transition-all duration-300 ease-in-out ${
          isOpen ? (collapsed ? 'w-20' : 'w-64') : '-translate-x-full lg:translate-x-0 lg:w-20'
        } ${!isOpen ? 'lg:block' : ''}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            {(!collapsed || isOpen) && <span className="text-lg font-bold text-gray-800">ads169th</span>}
          </div>
          {isOpen && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded lg:hidden"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      // ปิด sidebar เฉพาะบน mobile
                      if (window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-blue-50'
                    } ${collapsed && !isOpen ? 'justify-center px-2' : ''}`}
                    title={collapsed && !isOpen ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {(!collapsed || isOpen) && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {(!collapsed || isOpen) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Connected to PostgreSQL</p>
              <p className="text-xs mt-1 text-gray-500">Version 15+</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
