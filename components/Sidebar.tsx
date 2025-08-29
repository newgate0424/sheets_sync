import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  Database, 
  Plus,
  Eye,
  Activity, 
  RefreshCw,
  Zap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();

  const navigation: NavItem[] = [
    {
      name: 'หน้าหลัก',
      href: '/',
      icon: Home,
      description: 'ภาพรวมและสถิติ'
    },
    {
      name: 'สร้างการตั้งค่า',
      href: '/config',
      icon: Plus,
      description: 'เพิ่มการซิงค์ใหม่'
    },
    {
      name: 'ดูข้อมูล',
      href: '/data',
      icon: Eye,
      description: 'เรียกดูข้อมูลในตาราง'
    }
  ];

  const quickActions = [
    {
      name: 'ซิงค์ทั้งหมด',
      icon: RefreshCw,
      action: 'sync-all',
      description: 'ซิงค์ข้อมูลทุก config'
    },
    {
      name: 'Real-time Sync',
      icon: Zap,
      action: 'realtime',
      description: 'จัดการซิงค์แบบเรียลไทม์'
    }
  ];

  const isCurrentPage = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:h-screen
        w-80 bg-white/90 backdrop-blur-xl
        shadow-2xl border-r border-slate-200/50
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl mr-4 shadow-lg">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    SheetSync
                  </h2>
                  <p className="text-sm text-slate-500">ระบบซิงค์ข้อมูล</p>
                </div>
              </div>
              
              {/* Close button for mobile */}
              <button
                onClick={onClose}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-2">
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                เมนูหลัก
              </h3>
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <div
                    className={`
                      flex items-center px-4 py-4 rounded-xl transition-all duration-300 group cursor-pointer mb-3
                      ${isCurrentPage(item.href)
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md border border-blue-100 transform scale-[1.02]'
                        : 'hover:bg-slate-50 hover:shadow-sm hover:scale-[1.01]'
                      }
                    `}
                  >
                    <div className={`
                      inline-flex items-center justify-center w-11 h-11 rounded-xl mr-4 transition-all duration-300
                      ${isCurrentPage(item.href)
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg'
                        : 'bg-slate-100 group-hover:bg-slate-200'
                      }
                    `}>
                      <item.icon className={`h-5 w-5 ${
                        isCurrentPage(item.href) ? 'text-white' : 'text-slate-600 group-hover:text-slate-700'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${
                        isCurrentPage(item.href) ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                        {item.name}
                      </div>
                      <div className="text-sm text-slate-500 group-hover:text-slate-600">
                        {item.description}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="px-3 py-1 text-xs rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                การดำเนินการ
              </h3>
              {quickActions.map((action) => (
                <div
                  key={action.name}
                  className="flex items-center px-4 py-4 rounded-xl transition-all duration-300 hover:bg-slate-50 hover:shadow-sm cursor-pointer mb-3 group hover:scale-[1.01]"
                  onClick={() => {
                    // Handle quick actions here
                    if (action.action === 'sync-all') {
                      // Trigger sync all
                      console.log('Sync all triggered from sidebar');
                    }
                  }}
                >
                  <div className="inline-flex items-center justify-center w-11 h-11 bg-slate-100 group-hover:bg-slate-200 rounded-xl mr-4 transition-all duration-300">
                    <action.icon className="h-5 w-5 text-slate-600 group-hover:text-slate-700" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-700 group-hover:text-slate-900">
                      {action.name}
                    </div>
                    <div className="text-sm text-slate-500 group-hover:text-slate-600">
                      {action.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200/50">
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100">
              <div className="flex items-center mb-3">
                <Activity className="h-4 w-4 text-emerald-500 mr-2" />
                <span className="text-sm font-semibold text-slate-700">สถานะระบบ</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Google API:</span>
                  <span className="text-emerald-600 font-medium">เชื่อมต่อแล้ว</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Database:</span>
                  <span className="text-emerald-600 font-medium">พร้อมใช้งาน</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="text-sm font-medium text-slate-600">
                SheetSync v1.0.0
              </div>
              <div className="text-xs text-slate-400 mt-1">
                พัฒนาด้วย Next.js & MySQL
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
