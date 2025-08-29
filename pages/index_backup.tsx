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
  jobs: Array<{
    configId: number;
    interval: number;
    isRunning: boolean;
    lastRun?: string;
  }>;
  totalJobs: number;
  activeJobs: number;
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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null);
  const [smartAutoPilot, setSmartAutoPilot] = useState<SmartAutoPilotStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // API status checks
  const [apiStatuses, setApiStatuses] = useState<Record<string, { ok: boolean; status: number | null; message?: string }>>({});

  const checkApis = async () => {
    // Get available configs first
    let availableConfigId = '1'; // default fallback
    try {
      const configsResponse = await fetch('/api/sync-configs', { cache: 'no-store' });
      if (configsResponse.ok) {
        const configsData = await configsResponse.json();
        if (configsData.configs && configsData.configs.length > 0) {
          availableConfigId = configsData.configs[0].id.toString();
        }
      }
    } catch (error) {
      console.log('Failed to get configs for API test, using default ID');
    }

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
    setCurrentPage(1);
    setSearchTerm('');
    fetchTableData(configId, 1, '');
  };

  const handleSearch = (search: string) => {
    if (selectedConfig) {
      fetchTableData(selectedConfig, 1, search);
    }
  };

  const handlePageChange = (page: number) => {
    if (selectedConfig) {
      fetchTableData(selectedConfig, page, searchTerm);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configsRes, statsRes, logsRes, realtimeRes, smartRes] = await Promise.all([
        fetch('/api/sync-configs'),
        fetch('/api/stats'),
        fetch('/api/sync-configs?logs=true'),
        fetch('/api/google/status'),
        fetch('/api/smart-auto')
      ]);

      const configsData = await configsRes.json();
      const statsData = await statsRes.json();
      const logsData = await logsRes.json();
      const realtimeData = await realtimeRes.json();
      const smartData = await smartRes.json();

      setConfigs(configsData.configs || []);
      setStats(statsData);
      setLogs(logsData.logs || []);
      setRealtimeStatus(realtimeData.success ? realtimeData.status : null);
      setSmartAutoPilot(smartData.success ? smartData.data : null);
  // update API statuses
  checkApis();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const runSync = async (configId: number) => {
    setSyncing(configId);
    try {
      const response = await fetch(`/api/sync/${configId}`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error running sync:', error);
    }
    setSyncing(null);
  };

  const runAllSync = async () => {
    setSyncing(-1);
    try {
      const response = await fetch('/api/sync/all', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error running all sync:', error);
    }
    setSyncing(null);
  };

  const deleteConfig = async (configId: number) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบ config นี้?')) {
      try {
        const response = await fetch(`/api/sync-configs?id=${configId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          fetchData();
        }
      } catch (error) {
        console.error('Error deleting config:', error);
      }
    }
  };

  const handleSmartAutoPilotToggle = async (action: 'enable' | 'disable') => {
    try {
      const response = await fetch('/api/smart-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling Smart Auto-Pilot:', error);
    }
  };

  useEffect(() => {
    fetchData();
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      // รีเฟรชทุกๆ 30 วินาที เมื่อเปิดใช้ auto refresh
      interval = setInterval(fetchData, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const isCurrentlyRunning = (configId: number) => {
    return realtimeStatus?.jobs.find(job => job.configId === configId)?.isRunning || false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-white/20">
          <div className="relative">
            <RefreshCw className="h-16 w-16 text-blue-600 mx-auto mb-6 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-blue-200/30 animate-ping"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">กำลังโหลดข้อมูล</h2>
          <p className="text-gray-600">โปรดรอสักครู่...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-lg shadow-xl border-b border-gray-100/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Brain className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    Smart Auto-Pilot
                  </h1>
                  <p className="text-gray-600 text-lg mt-1">ระบบซิงค์อัตโนมัติแบบอัจฉริยะ</p>
                </div>
              </div>
              
              <div className="flex items-center flex-wrap gap-3">
                <div className="flex items-center px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-green-800 text-sm font-medium">ระบบพร้อมใช้งาน</span>
                </div>
                
                <div className="flex items-center px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                  <Brain className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-blue-800 text-sm font-medium">Smart Delta Sync</span>
                </div>
                
                {autoRefresh && (
                  <div className="flex items-center px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200">
                    <RefreshCw className="w-3 h-3 text-yellow-600 mr-2 animate-spin" />
                    <span className="text-yellow-800 text-xs font-medium">Auto-refresh 30s</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 ml-8">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant="outline"
                className={`${
                  autoRefresh 
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' 
                    : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                } transition-all duration-300 px-4 py-2 text-sm font-medium rounded-lg shadow-sm`}
              >
                {autoRefresh ? (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Auto ON
                  </>
                ) : (
                  <>
                    <StopCircle className="h-4 w-4 mr-2" />
                    Auto OFF
                  </>
                )}
              </Button>
              
              <Link href="/data">
                <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-5 py-2 rounded-lg font-medium">
                  <Eye className="h-4 w-4 mr-2" />
                  ดูข้อมูล
                </Button>
              </Link>
              
              <Button 
                onClick={() => fetchData()} 
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
              {/* Background Pattern */}
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
                      <div className="text-xl font-bold text-white mb-1">
                        {smartAutoPilot.smartSyncEnabled ? 'SMART' : 'STANDARD'}
                      </div>
                      <div className="text-indigo-200 text-sm font-medium">
                        {smartAutoPilot.smartSyncEnabled ? 'Delta Sync' : 'Full Check'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-indigo-100 mb-4 text-lg">{smartAutoPilot.description}</p>
                  <Button
                    onClick={() => handleSmartAutoPilotToggle(smartAutoPilot.smartSyncEnabled ? 'disable' : 'enable')}
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 hover:border-white/50 backdrop-blur-sm transition-all duration-300 px-6 py-2 rounded-lg font-medium"
                  >
                    {smartAutoPilot.smartSyncEnabled ? (
                      <>
                        <StopCircle className="h-4 w-4 mr-2" />
                        ปิด Smart Mode
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        เปิด Smart Mode
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Configs</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.total_configs || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Active Configs</p>
                <p className="text-3xl font-bold text-green-600">{stats?.active_configs || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Rows</p>
                <p className="text-3xl font-bold text-purple-600">{stats?.total_rows?.toLocaleString() || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Running Jobs</p>
                <p className="text-3xl font-bold text-orange-600">{realtimeStatus?.activeJobs || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
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
            {tableData.totalPages > 1 && (
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

        {/* Recent Activity */}
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
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {tableData.totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  แสดง {Math.min((currentPage - 1) * 10 + 1, tableData.totalRows)} ถึง{' '}
                  {Math.min(currentPage * 10, tableData.totalRows)} จาก {tableData.totalRows.toLocaleString()} แถว
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    ก่อนหน้า
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, tableData.totalPages) }, (_, i) => {
                      const page = Math.max(1, currentPage - 2) + i;
                      if (page > tableData.totalPages) return null;
                      
                      return (
                        <Button
                          key={page}
                          size="sm"
                          variant={page === currentPage ? "default" : "outline"}
                          className={page === currentPage ? "bg-purple-600 hover:bg-purple-700" : ""}
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= tableData.totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sync Configurations */}
          <div className="lg:col-span-2">
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
      </div>

      {/* API Status Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <div className="text-sm text-gray-300 mr-6 flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              API Status
            </div>
            <div className="flex items-center flex-wrap gap-4">
              {Object.keys(apiStatuses).length === 0 ? (
                <div className="flex items-center px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                  <RefreshCw className="h-3 w-3 mr-1.5 text-yellow-400 animate-spin" />
                  <span className="text-yellow-400 text-sm font-medium">Checking...</span>
                </div>
              ) : (
                Object.entries(apiStatuses).map(([key, val]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300 font-medium">{key}</span>
                    <div className={`flex items-center px-2 py-1 rounded-full text-xs font-bold border ${
                      val.ok 
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-red-500/20 border-red-500/30 text-red-400'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        val.ok ? 'bg-emerald-400' : 'bg-red-400'
                      } ${val.ok ? 'animate-pulse' : ''}`}></div>
                      {val.ok ? 'OK' : 'DOWN'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <Link href="/config">
          <Button className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 group border-2 border-white/20">
            <Plus className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
