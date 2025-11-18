'use client';

import { useState, useEffect } from 'react';
import { Database, Table2, RefreshCw, Clock, CheckCircle, XCircle, TrendingUp, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentSyncs, setRecentSyncs] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh ทุก 5 วินาที
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    // ไม่ต้อง setLoading(true) ในการ refresh เพื่อไม่ให้กระพริบ
    const isInitialLoad = stats === null;
    if (isInitialLoad) setLoading(true);
    
    try {
      // ดึงข้อมูลสถิติ
      const [statsRes, syncsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/recent-syncs')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (syncsRes.ok) {
        const syncsData = await syncsRes.json();
        setRecentSyncs(syncsData.syncs || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600 mt-1">ภาพรวมระบบซิงค์ข้อมูล Google Sheets</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          รีเฟรช
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tables */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ตารางทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {stats?.totalTables || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Table2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Rows */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">แถวทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {stats?.totalRows?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Database className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Active Cron Jobs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cron Jobs</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {stats?.activeCronJobs || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">อัตราสำเร็จ</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {stats?.successRate || 0}%
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Syncs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            การซิงค์ล่าสุด
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ตาราง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จำนวนแถว
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  เวลา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ระยะเวลา
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentSyncs.length > 0 ? (
                recentSyncs.map((sync, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Table2 className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {sync.table_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sync.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          สำเร็จ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          ล้มเหลว
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.row_count?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.synced_at 
                        ? new Date(sync.synced_at).toLocaleString('th-TH', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.duration ? `${sync.duration}s` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    ไม่มีข้อมูลการซิงค์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">ข้อมูลระบบ</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Database Type:</span>
              <span className="text-sm font-medium text-gray-800">
                {stats?.dbType === 'mysql' ? 'MySQL/MariaDB' : 'PostgreSQL'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Folders:</span>
              <span className="text-sm font-medium text-gray-800">
                {stats?.totalFolders || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Updated:</span>
              <span className="text-sm font-medium text-gray-800">
                {new Date().toLocaleString('th-TH')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">สถิติการซิงค์</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ซิงค์วันนี้:</span>
              <span className="text-sm font-medium text-gray-800">
                {stats?.syncsToday || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ซิงค์สัปดาห์นี้:</span>
              <span className="text-sm font-medium text-gray-800">
                {stats?.syncsThisWeek || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ซิงค์เดือนนี้:</span>
              <span className="text-sm font-medium text-gray-800">
                {stats?.syncsThisMonth || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
