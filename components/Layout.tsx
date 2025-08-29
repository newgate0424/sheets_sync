import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Menu, 
  X, 
  Home, 
  Database, 
  Settings, 
  Activity, 
  BarChart3, 
  Eye, 
  Wrench,
  Brain,
  Zap,
  FileSpreadsheet,
  Monitor,
  ChevronLeft,
  ChevronRight,
  CircleDot
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'Smart Auto-Pilot' }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'View Data', href: '/data', icon: Eye },
    { name: 'Configurations', href: '/config', icon: Settings },
    { name: 'API Status', href: '/api-status', icon: Wrench },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full bg-white border-r border-gray-100 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            {sidebarOpen ? (
              <>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                      <Brain className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white">
                      <CircleDot className="h-2 w-2 text-white m-0.5" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      Smart Pilot
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">Auto Sync System</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-3 rounded-xl hover:bg-gray-50 transition-colors mx-auto group"
              >
                <div className="relative">
                  <Brain className="h-6 w-6 text-blue-600" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={`group flex items-center px-4 py-4 rounded-2xl transition-all duration-200 ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } ${!sidebarOpen ? 'justify-center px-3 py-3' : ''}`}
                  >
                    <Icon className={`h-6 w-6 ${sidebarOpen ? 'mr-4' : ''} ${
                      active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                    }`} />
                    {sidebarOpen && (
                      <span className="font-semibold text-base">{item.name}</span>
                    )}
                    {active && sidebarOpen && (
                      <div className="ml-auto w-2 h-2 bg-white/50 rounded-full"></div>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100">
            {sidebarOpen ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">System Status</p>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      </div>
                      <span className="text-sm font-medium text-green-700">All Systems Online</span>
                    </div>
                  </div>
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Activity className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <div className="absolute inset-0 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
        {/* Top Bar */}
        <header className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                <p className="text-base text-gray-500 mt-2">
                  {new Date().toLocaleDateString('th-TH', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100">
                  <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-sm font-semibold text-green-700">System Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
