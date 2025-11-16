'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

interface SyncLog {
  id: number;
  status: 'running' | 'success' | 'error' | 'skipped';
  table_name: string;
  dataset_name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  inserted: number;
  updated: number;
  deleted: number;
  error_message: string | null;
}

const statusStyles = {
  running: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
  success: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  error: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
};

function LogPageContent() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
    
    // Auto-refresh ทุก 5 วินาที
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/sync-logs');
      const data = await response.json();
      // เก็บแค่ 50 แถวล่าสุด
      setLogs(data.slice(0, 50));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.dataset_name.toLowerCase().includes(searchTerm.toLowerCase());
    // แปลง skipped เป็น success ในการกรอง
    const displayStatus = log.status === 'skipped' ? 'success' : log.status;
    const matchesStatus = filterStatus === 'all' || displayStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-500" />
            Sync Logs
          </h1>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหา table name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="running">Running</option>
            <option value="success">Success (รวมไม่มีอัปเดต)</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg">ไม่พบ sync logs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Table Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Started At</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Inserted</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Deleted</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => {
                  // แสดง status skipped เป็น success แต่ข้อความเป็น "no update"
                  const displayStatus = log.status === 'skipped' ? 'success' : log.status;
                  const style = statusStyles[displayStatus as keyof typeof statusStyles] || statusStyles.error;
                  const Icon = style.icon;
                  const isSkipped = log.status === 'skipped';

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${style.bg}`}>
                            <Icon className={`w-4 h-4 ${style.text}`} />
                          </div>
                          <span className={`text-xs font-medium ${style.text} uppercase`}>
                            {displayStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{log.table_name}</div>
                          <div className="text-xs text-gray-500">{log.dataset_name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(log.started_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600" colSpan={3}>
                        {isSkipped ? (
                          <span className="text-gray-500 italic text-sm">ไม่มีอัปเดต</span>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              {log.inserted > 0 ? (
                                <span className="text-green-600 font-medium">+{log.inserted}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                            <div>
                              {log.updated > 0 ? (
                                <span className="text-blue-600 font-medium">{log.updated}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                            <div>
                              {log.deleted > 0 ? (
                                <span className="text-red-600 font-medium">-{log.deleted}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.error_message ? (
                          <div className="flex items-start gap-2 max-w-md">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-red-600 line-clamp-2">{log.error_message}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkDesktop();
    setSidebarOpen(window.innerWidth >= 1024);
    
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={!sidebarOpen && isDesktop} />
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      
      <main className={`transition-all duration-300 pt-16 ${sidebarOpen && isDesktop ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <div className="p-4 md:p-6 lg:p-8">
          <LogPageContent />
        </div>
      </main>
    </div>
  );
}
