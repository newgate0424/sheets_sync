import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Database, FileSpreadsheet, Activity, Clock, Edit, Trash2, Eye, Zap, StopCircle, PlayCircle, Brain, Settings, TrendingUp, CheckCircle, XCircle, AlertTriangle, BarChart3, EyeOff, X, ChevronLeft, ChevronRight, Users } from 'lucide-react';

interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  is_active: boolean;
  last_sync_at?: string;
  row_count: number;
}

interface SyncStats {
  total_configs: number;
  active_configs: number;
  total_rows: number;
}

interface SyncLog {
  id: number;
  config_id: number;
  config_name: string;
  status: string;
  rows_synced: number;
  created_at: string;
}

interface RealtimeStatus {
  running: boolean;
  totalJobs: number;
  activeJobs: number;
  jobs: Array<{
    configId: number;
    interval: number;
    lastRun?: string;
  }>;
}

interface SmartAutoPilotStatus {
  smartSyncEnabled: boolean;
  status: string;
  description: string;
  activeSyncJobs: number;
  pollingJobs: number;
  lastActivity: string;
}

interface TableData {
  configId: number;
  configName: string;
  tableName: string;
  totalRows: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  columns: string[];
  data: any[];
  lastSyncAt?: string;
  searchTerm: string;
}

export default function Dashboard() {
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<Record<string, any>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null);
  const [smartAutoPilot, setSmartAutoPilot] = useState<SmartAutoPilotStatus | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, statsRes, logsRes, realtimeRes, smartRes] = await Promise.all([
        fetch('/api/sync-configs', { cache: 'no-store' }),
        fetch('/api/stats', { cache: 'no-store' }),
        fetch('/api/sync/status', { cache: 'no-store' }),
        fetch('/api/sync/realtime', { cache: 'no-store' }),
        fetch('/api/smart-auto', { cache: 'no-store' }),
      ]);

      if (configsRes.ok) {
        const configsData = await configsRes.json();
        setConfigs(configsData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }

      if (realtimeRes.ok) {
        const realtimeData = await realtimeRes.json();
        setRealtimeStatus(realtimeData);
      }

      if (smartRes.ok) {
        const smartData = await smartRes.json();
        setSmartAutoPilot(smartData);
      }

      // Check API statuses
      await checkAllApiStatuses();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAllApiStatuses = async () => {
    const availableConfigId = configs.length > 0 ? configs[0].id : 1;
    const endpoints = [
      { key: 'sync-configs', url: '/api/sync-configs' },
      { key: 'stats', url: '/api/stats' },
      { key: 'google', url: '/api/google/status' },
      { key: 'smart', url: '/api/smart-auto' },
      { key: 'data-view', url: `/api/data/view?configId=${availableConfigId}&page=1&pageSize=1` }
    ];

    const results: Record<string, any> = {};
    await Promise.all(endpoints.map(async (e) => {
      try {
        const res = await fetch(e.url, { cache: 'no-store' });
        let msg = '';
        try {
          const json = await res.clone().json();
          if (json?.success === false && json?.suggestion) {
            msg = json.suggestion;
          } else {
            msg = json?.message || (json?.success ? 'OK' : JSON.stringify(json));
          }
        } catch (_) {
          msg = await res.clone().text();
        }
        results[e.key] = { ok: res.ok, status: res.status, message: msg };
      } catch (err) {
        results[e.key] = { ok: false, status: null, message: String(err) };
      }
    }));

    setApiStatuses(results);
  };

  const fetchTableData = async (configId: number, page: number = 1, search: string = '') => {
    try {
      const response = await fetch(`/api/data/view?configId=${configId}&page=${page}&pageSize=10&search=${encodeURIComponent(search)}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setTableData(data);
        setCurrentPage(page);
        setSearchTerm(search);
      } else {
        console.error('Failed to fetch table data');
        setTableData(null);
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
      setTableData(null);
    }
  };

  const handleConfigSelect = (configId: number) => {
    setSelectedConfig(configId);
    fetchTableData(configId, 1, '');
  };

  const handleSearch = (term: string) => {
    if (selectedConfig) {
      fetchTableData(selectedConfig, 1, term);
    }
  };

  const handlePageChange = (page: number) => {
    if (selectedConfig) {
      fetchTableData(selectedConfig, page, searchTerm);
    }
  };

  const runSync = async (configId: number) => {
    setSyncing(configId);
    try {
      const response = await fetch(`/api/sync/${configId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        loadData();
      } else {
        console.error('Sync failed');
      }
    } catch (error) {
      console.error('Error running sync:', error);
    } finally {
      setSyncing(null);
    }
  };

  const runAllSync = async () => {
    setSyncing(-1);
    try {
      const response = await fetch('/api/sync/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        loadData();
      } else {
        console.error('Bulk sync failed');
      }
    } catch (error) {
      console.error('Error running bulk sync:', error);
    } finally {
      setSyncing(null);
    }
  };

  const deleteConfig = async (configId: number) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการตั้งค่านี้?')) {
      try {
        const response = await fetch(`/api/sync-configs/${configId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          loadData();
        } else {
          console.error('Delete failed');
        }
      } catch (error) {
        console.error('Error deleting config:', error);
      }
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return `${diffDays} วันที่แล้ว`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const isCurrentlyRunning = (configId: number) => {
    return syncing === configId || realtimeStatus?.jobs.some(job => job.configId === configId) || false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Database className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Google Sheets Sync Dashboard</h1>
                <p className="text-gray-600">ระบบซิงค์ข้อมูลอัตโนมัติ</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button 
                onClick={loadData} 
                disabled={loading} 
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-5 py-2 rounded-lg font-medium"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              
              <Button 
                onClick={runAllSync} 
                disabled={syncing !== null} 
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-5 py-2 rounded-lg font-medium"
              >
                <Database className="h-4 w-4 mr-2" />
                ซิงค์ทั้งหมด
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Smart Auto-Pilot Status Card */}
        {smartAutoPilot && (
          <div className="relative overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 rounded-2xl shadow-2xl border border-white/10">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-x-16 translate-y-16"></div>
              </div>
              
              <div className="relative p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Brain className="h-10 w-10 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-1">Smart Auto-Pilot System</h2>
                      <p className="text-indigo-100 text-lg">ระบบซิงค์อัจฉริยะที่ประหยัดเวลาและทรัพยากร</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold shadow-lg ${
                      smartAutoPilot.smartSyncEnabled 
                        ? 'bg-emerald-500/90 text-white' 
                        : 'bg-gray-500/90 text-white'
                    }`}>
                      {smartAutoPilot.status}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{smartAutoPilot.activeSyncJobs}</div>
                      <div className="text-indigo-200 text-sm font-medium">Active Jobs</div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{smartAutoPilot.pollingJobs}</div>
                      <div className="text-indigo-200 text-sm font-medium">Polling Jobs</div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-center">
                      <div className="text-white mb-1">
                        {smartAutoPilot.lastActivity && formatTimeAgo(smartAutoPilot.lastActivity)}
                      </div>
                      <div className="text-indigo-200 text-sm font-medium">Last Activity</div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-indigo-100 text-lg leading-relaxed max-w-2xl mx-auto">
                    {smartAutoPilot.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Configurations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_configs}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Configurations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_configs}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_rows.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sync Configurations */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Sync Configurations</h3>
                    <p className="text-sm text-gray-500">{configs.length} การตั้งค่า</p>
                  </div>
                </div>
                <Link href="/config">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่ม Config
                  </Button>
                </Link>
              </div>
              
              <div className="p-6">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {configs.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <FileSpreadsheet className="h-10 w-10 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มี Configuration</h4>
                      <p className="text-gray-500 mb-6">เริ่มต้นด้วยการสร้างการตั้งค่าการซิงค์แรก</p>
                      <Link href="/config">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                          เพิ่ม Config แรก
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    configs.map((config) => {
                      const isRunning = isCurrentlyRunning(config.id);
                      const jobStatus = realtimeStatus?.jobs.find(job => job.configId === config.id);
                      
                      return (
                        <div key={config.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors duration-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="font-medium text-gray-900">{config.name}</h4>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    config.is_active 
                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                                  }`}>
                                    {config.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                  {isRunning && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                                      <Activity className="h-3 w-3 inline mr-1" />
                                      Running
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-2">
                                {config.sheet_name} → {config.table_name}
                                <span className="ml-2 text-blue-600 font-medium">
                                  {config.row_count.toLocaleString()} rows
                                </span>
                              </p>
                              
                              {config.last_sync_at && (
                                <p className="text-xs text-gray-500 flex items-center mb-1">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Last sync: {formatTimeAgo(config.last_sync_at)}
                                </p>
                              )}
                              
                              {jobStatus && (
                                <p className="text-xs text-blue-600">
                                  Auto-sync every {Math.floor(jobStatus.interval / 60000)} minutes
                                  {jobStatus.lastRun && ` (Last: ${formatTimeAgo(jobStatus.lastRun)})`}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="p-2 text-purple-600 hover:bg-purple-50 hover:border-purple-300"
                                onClick={() => handleConfigSelect(config.id)}
                                title="ดูข้อมูลในตาราง"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              <Link href={`/config/${config.id}`}>
                                <Button variant="outline" size="sm" className="p-2 hover:bg-gray-100">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              
                              <Button
                                onClick={() => runSync(config.id)}
                                disabled={syncing === config.id || isRunning}
                                variant="outline"
                                size="sm"
                                className="p-2 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              >
                                {syncing === config.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Database className="h-4 w-4" />
                                )}
                              </Button>
                              
                              <Button
                                onClick={() => deleteConfig(config.id)}
                                variant="outline"
                                size="sm"
                                className="p-2 text-red-600 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center space-x-3 p-6 border-b border-gray-100">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
                  <p className="text-sm text-gray-500">กิจกรรมล่าสุด</p>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Activity className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500">ไม่มีกิจกรรมล่าสุด</p>
                    </div>
                  ) : (
                    logs.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors duration-200">
                        <div className={`p-1.5 rounded-full flex-shrink-0 ${getStatusColor(log.status)}`}>
                          {log.status === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : log.status === 'error' ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{log.config_name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {log.status === 'success' ? `Synced ${log.rows_synced} rows` : 'Sync failed'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeAgo(log.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Data Section */}
        {selectedConfig && tableData && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{tableData.configName}</h3>
                  <p className="text-sm text-gray-500">
                    {tableData.totalRows.toLocaleString()} แถว • หน้า {tableData.currentPage} จาก {tableData.totalPages}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ค้นหาข้อมูล..."
                    className="w-64 px-4 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <Button
                  onClick={() => {setSelectedConfig(null); setTableData(null);}}
                  variant="outline"
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="h-4 w-4 mr-2" />
                  ปิด
                </Button>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {tableData.columns.slice(0, 6).map((column, idx) => (
                      <th key={idx} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {column}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tableData.data.map((row: any, rowIdx: number) => (
                    <tr key={rowIdx} className="hover:bg-gray-50">
                      {tableData.columns.slice(0, 6).map((column, colIdx) => (
                        <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                          {String(row[column] || '-')}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1 text-blue-600 hover:bg-blue-50"
                            onClick={() => alert(`ดูรายละเอียดแถว ${rowIdx + 1}`)}
                            title="ดูรายละเอียด"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1 text-orange-600 hover:bg-orange-50"
                            onClick={() => alert(`แก้ไขแถว ${rowIdx + 1}`)}
                            title="แก้ไข"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1 text-red-600 hover:bg-red-50"
                            onClick={() => alert(`ลบแถว ${rowIdx + 1}`)}
                            title="ลบ"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {tableData && tableData.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    แสดง {((tableData.currentPage - 1) * 20) + 1} ถึง {Math.min(tableData.currentPage * 20, tableData.totalRows)} 
                    จากทั้งหมด {tableData.totalRows.toLocaleString()} แถว
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => handlePageChange(tableData.currentPage - 1)}
                      disabled={tableData.currentPage <= 1}
                      variant="outline"
                      size="sm"
                      className="px-3 py-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="px-3 py-1 text-sm font-medium text-gray-700">
                      หน้า {tableData.currentPage} จาก {tableData.totalPages}
                    </span>
                    
                    <Button
                      onClick={() => handlePageChange(tableData.currentPage + 1)}
                      disabled={tableData.currentPage >= tableData.totalPages}
                      variant="outline"
                      size="sm"
                      className="px-3 py-1"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Status Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center space-y-4">
            <h3 className="text-lg font-semibold">API Status Monitor</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-4xl">
              {Object.entries(apiStatuses).map(([key, status]) => (
                <div key={key} className={`p-3 rounded-lg text-center ${
                  status.ok ? 'bg-green-600/20 border border-green-400/30' : 'bg-red-600/20 border border-red-400/30'
                }`}>
                  <div className="text-sm font-medium capitalize">{key.replace('-', ' ')}</div>
                  <div className={`text-xs mt-1 ${status.ok ? 'text-green-300' : 'text-red-300'}`}>
                    {status.ok ? '✅ OK' : `❌ ${status.status || 'ERROR'}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 truncate" title={status.message}>
                    {status.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Refresh Control */}
      <div className="fixed bottom-8 right-8 z-40">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2">
          <div className="text-xs text-gray-600 mb-1">Auto-refresh: 30s</div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{width: '100%'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
