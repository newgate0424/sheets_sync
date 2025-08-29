import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '../components/ui/button';
import { RefreshCw, Plus, Database, FileSpreadsheet, Activity, Clock, Edit, Trash2, Eye, Zap, StopCircle, PlayCircle, Brain, Settings, TrendingUp, CheckCircle, XCircle, AlertTriangle, BarChart3, EyeOff, X, ChevronLeft, ChevronRight, Users } from 'lucide-react';

interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  is_active: boolean;
  last_sync_at?: string;
  row_count?: number;
}

interface SyncStats {
  total_configs: number;
  active_configs: number;
  total_rows: number;
  last_global_sync?: string;
}

interface SyncLog {
  id: number;
  config_id: number;
  status: string;
  message: string;
  rows_synced: number;
  created_at: string;
}

interface RealtimeStatus {
  active: boolean;
  activeConfigs: number;
  lastActivity: string;
}

interface SmartAutoPilotStatus {
  active: boolean;
  totalConfigs: number;
  activeConfigs: number;
  lastActivity: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<Record<string, any>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus | null>(null);
  const [smartAutoPilot, setSmartAutoPilot] = useState<SmartAutoPilotStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadData = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [configsRes, statsRes] = await Promise.all([
        fetch('/api/sync-configs', { cache: 'no-store' }),
        fetch('/api/stats', { cache: 'no-store' })
      ]);

      if (configsRes.ok) {
        const configsData = await configsRes.json();
        setConfigs(Array.isArray(configsData) ? configsData : []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setLogs(Array.isArray(statsData.recentLogs) ? statsData.recentLogs : []);
      }

      await Promise.all([
        checkAllApiStatuses(),
        checkRealtimeStatus(),
        checkSmartAutoPilot()
      ]);

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

  const checkRealtimeStatus = async () => {
    try {
      const response = await fetch('/api/sync/realtime', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setRealtimeStatus(data);
      }
    } catch (error) {
      console.error('Error checking realtime status:', error);
    }
  };

  const checkSmartAutoPilot = async () => {
    try {
      const response = await fetch('/api/smart-auto', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setSmartAutoPilot(data);
      }
    } catch (error) {
      console.error('Error checking smart auto-pilot:', error);
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
        console.error('Sync all failed');
      }
    } catch (error) {
      console.error('Error running sync all:', error);
    } finally {
      setSyncing(null);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-600';
      case 'error': return 'bg-red-100 text-red-600';
      case 'warning': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadData, 30000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <Database className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Google Sheets ↔ MySQL Sync
              </h1>
              <p className="text-gray-600 mt-1">Real-time data synchronization dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              onClick={toggleAutoRefresh}
              variant={autoRefresh ? "default" : "outline"}
              className={autoRefresh ? 
                "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" :
                "text-gray-600 hover:text-gray-900 border-gray-300"
              }
            >
              {autoRefresh ? <StopCircle className="h-4 w-4 mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              {autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh'}
            </Button>
            
            <Button
              onClick={loadData}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            
            <Link href="/config">
              <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Sheet
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Configs</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.total_configs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Syncs</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.active_configs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_rows ? stats.total_rows.toLocaleString() : '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Last Sync</p>
                <p className="text-sm font-bold text-gray-900">
                  {stats?.last_global_sync ? formatTimeAgo(stats.last_global_sync) : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Real-time Sync Status */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Real-time Sync</h3>
                  <p className="text-sm text-gray-500">Background synchronization status</p>
                </div>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                realtimeStatus?.active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {realtimeStatus?.active ? 'Active' : 'Inactive'}
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{realtimeStatus?.activeConfigs || 0}</p>
                  <p className="text-sm text-gray-600">Active Configs</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {realtimeStatus?.lastActivity ? formatTimeAgo(realtimeStatus.lastActivity) : 'No activity'}
                  </p>
                  <p className="text-sm text-gray-600">Last Activity</p>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Auto-Pilot Status */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Smart Auto-Pilot</h3>
                  <p className="text-sm text-gray-500">Intelligent sync management</p>
                </div>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                smartAutoPilot?.active 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {smartAutoPilot?.active ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{smartAutoPilot?.activeConfigs || 0}</p>
                  <p className="text-sm text-gray-600">Managed Configs</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {smartAutoPilot?.lastActivity ? formatTimeAgo(smartAutoPilot.lastActivity) : 'No activity'}
                  </p>
                  <p className="text-sm text-gray-600">Last Activity</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Configurations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Settings className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Sync Configurations</h3>
                    <p className="text-sm text-gray-500">{configs.length} total configurations</p>
                  </div>
                </div>
                
                <Button
                  onClick={runAllSync}
                  disabled={syncing === -1}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {syncing === -1 ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Sync All
                </Button>
              </div>
              
              <div className="divide-y divide-gray-100">
                {configs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <FileSpreadsheet className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations found</h3>
                    <p className="text-gray-500 mb-4">Get started by adding your first Google Sheet</p>
                    <Link href="/config">
                      <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Sheet
                      </Button>
                    </Link>
                  </div>
                ) : (
                  configs.map((config) => (
                    <div key={config.id} className="p-6 hover:bg-gray-50/50 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${config.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <h4 className="text-lg font-semibold text-gray-900">{config.name}</h4>
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {config.table_name}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <Database className="h-4 w-4 mr-1" />
                            {config.row_count ? config.row_count.toLocaleString() : '0'} rows
                            {config.last_sync_at && (
                              <>
                                <span className="mx-2">•</span>
                                <Clock className="h-4 w-4 mr-1" />
                                Last sync {formatTimeAgo(config.last_sync_at)}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-2 text-purple-600 hover:bg-purple-50 hover:border-purple-300"
                            onClick={() => router.push(`/data/${config.id}`)}
                            title="ดูข้อมูลในตาราง"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Link href={`/config/${config.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="p-2 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              title="แก้ไขการตั้งค่า"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-2 text-green-600 hover:bg-green-50 hover:border-green-300"
                            onClick={() => runSync(config.id)}
                            disabled={syncing === config.id}
                            title="เริ่ม Sync"
                          >
                            {syncing === config.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
                  <p className="text-sm text-gray-500">Latest sync activities</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {!logs || !Array.isArray(logs) || logs.length === 0 ? (
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
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.message}
                        </p>
                        <p className="text-sm text-gray-600">
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

      {/* API Status Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-6 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center space-y-4">
            <h3 className="text-lg font-semibold">API Status Monitor</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-4xl">
              {Object.entries(apiStatuses).map(([key, status]) => (
                <div key={key} className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      status.ok ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className="text-sm font-medium capitalize">{key}</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    {status.status && `${status.status} • `}
                    {typeof status.message === 'string' ? 
                      (status.message.length > 20 ? 
                        `${status.message.substring(0, 20)}...` : 
                        status.message
                      ) : 
                      'Unknown'
                    }
                  </p>
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-gray-400">
              <p>Real-time API health monitoring • Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}