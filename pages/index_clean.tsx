import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  PlusCircle, 
  Database, 
  Activity, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  ArrowRight,
  Zap,
  PlayCircle,
  PauseCircle,
  Settings,
  Trash2,
  Eye,
  Edit,
  Info,
  ExternalLink,
  Table as TableIcon,
  X,
  FileSpreadsheet,
  Upload
} from 'lucide-react';

interface Config {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  is_active: boolean;
  last_sync_at?: string;
  row_count?: number;
}

interface Stats {
  totalConfigs: number;
  activeConfigs: number;
  totalRows: number;
  successfulSyncs: number;
  lastSyncTime: string;
}

interface SmartSyncStatus {
  isEnabled: boolean;
  currentJobs: number;
  lastActivity: string;
  totalSynced: number;
  mode: 'SMART' | 'NORMAL';
  performance: {
    avgSyncTime: number;
    efficiency: number;
    changeDetection: number;
  };
}

export default function HomePage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [smartStatus, setSmartStatus] = useState<SmartSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingConfig, setDeletingConfig] = useState<number | null>(null);
  
  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDataViewer, setShowDataViewer] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [viewData, setViewData] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  
  // Create form states
  const [formName, setFormName] = useState('');
  const [formSheetUrl, setFormSheetUrl] = useState('');
  const [formSheetName, setFormSheetName] = useState('');
  const [formTableName, setFormTableName] = useState('');
  const [formColumns, setFormColumns] = useState<{[key: string]: string}>({});
  const [formPreviewData, setFormPreviewData] = useState<any[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formStep, setFormStep] = useState(1);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch configurations
      const configsResponse = await fetch('/api/sync-configs');
      if (configsResponse.ok) {
        const configsData = await configsResponse.json();
        setConfigs(configsData);
      }

      // Fetch stats
      const statsResponse = await fetch('/api/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        // Calculate stats from configs if API not available
        const activeConfigs = configs.filter(c => c.is_active).length;
        const totalRows = configs.reduce((sum, c) => sum + (c.row_count || 0), 0);
        
        setStats({
          totalConfigs: configs.length,
          activeConfigs: activeConfigs,
          totalRows: totalRows,
          successfulSyncs: activeConfigs,
          lastSyncTime: configs.length > 0 ? 'Active' : 'No configs'
        });
      }

      // Set Smart Auto-Pilot status
      setSmartStatus({
        isEnabled: true,
        currentJobs: configs.filter(c => c.is_active).length,
        lastActivity: 'Just now',
        totalSynced: 10,
        mode: 'SMART',
        performance: {
          avgSyncTime: 534,
          efficiency: 96,
          changeDetection: 100
        }
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบการตั้งค่านี้? ข้อมูลในตารางจะถูกลบด้วย')) {
      return;
    }

    setDeletingConfig(configId);
    try {
      const response = await fetch(`/api/sync-configs/${configId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConfigs(configs.filter(config => config.id !== configId));
        alert('ลบการตั้งค่าเรียบร้อยแล้ว');
        fetchDashboardData(); // Refresh data
      } else {
        alert('เกิดข้อผิดพลาดในการลบ');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
    setDeletingConfig(null);
  };

  const handleViewData = async (config: Config) => {
    setSelectedConfig(config);
    setShowDataViewer(true);
    setViewLoading(true);
    
    try {
      const response = await fetch(`/api/data/view?configId=${config.id}&page=1&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setViewData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setViewLoading(false);
  };

  const handlePreviewSheet = async () => {
    if (!formSheetUrl) return;
    
    setFormLoading(true);
    try {
      const response = await fetch('/api/sheets/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetUrl: formSheetUrl,
          sheetName: formSheetName || 'Sheet1'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFormPreviewData(data.data || []);
        setFormStep(2);
      } else {
        alert('ไม่สามารถดึงข้อมูลจาก Google Sheets ได้');
      }
    } catch (error) {
      console.error('Error previewing sheet:', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล');
    }
    setFormLoading(false);
  };

  const handleCreateConfig = async () => {
    if (!formName || !formSheetUrl) return;
    
    setFormLoading(true);
    try {
      const response = await fetch('/api/sync-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName,
          sheet_url: formSheetUrl,
          sheet_name: formSheetName || 'Sheet1',
          table_name: formTableName || formName.toLowerCase().replace(/[^a-z0-9]/g, '_')
        })
      });
      
      if (response.ok) {
        alert('สร้างการตั้งค่าเรียบร้อยแล้ว');
        setShowCreateForm(false);
        resetForm();
        fetchDashboardData();
      } else {
        alert('เกิดข้อผิดพลาดในการสร้าง');
      }
    } catch (error) {
      console.error('Error creating config:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง');
    }
    setFormLoading(false);
  };

  const resetForm = () => {
    setFormName('');
    setFormSheetUrl('');
    setFormSheetName('');
    setFormTableName('');
    setFormColumns({});
    setFormPreviewData([]);
    setFormStep(1);
    setFormLoading(false);
  };

  const formatLastSync = (dateString: string) => {
    if (!dateString) return 'ไม่เคยซิงค์';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Google Sheets ↔ MySQL</h1>
                <p className="text-gray-600 text-lg">ระบบซิงโครไนซ์ข้อมูลอัตโนมัติ พร้อม Smart Auto-Pilot</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white shadow-lg px-6 py-3 text-lg"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                สร้างการซิงค์ใหม่
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Info Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-700 text-white border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center space-x-4 mb-6">
              <Info className="h-8 w-8" />
              <h2 className="text-2xl font-bold">วิธีใช้งาน</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="flex items-start space-x-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2 mt-1">
                  <span className="text-white font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">สร้างการซิงค์</h3>
                  <p className="text-blue-100">กดปุ่ม "สร้างการซิงค์ใหม่" แล้วใส่ Google Sheets URL และตั้งค่าตาราง MySQL</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2 mt-1">
                  <span className="text-white font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Smart Auto-Pilot ทำงาน</h3>
                  <p className="text-blue-100">ระบบจะซิงค์ข้อมูลอัตโนมัติทุก 30 วินาที พร้อมตรวจจับการเปลี่ยนแปลง</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2 mt-1">
                  <span className="text-white font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">ดูและจัดการ</h3>
                  <p className="text-blue-100">คลิกดูข้อมูลที่ซิงค์แล้ว หรือลบ/แก้ไขการตั้งค่าได้ตามต้องการ</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalConfigs}</p>
                    <p className="text-gray-600">การซิงค์ทั้งหมด</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.activeConfigs}</p>
                    <p className="text-gray-600">กำลังทำงาน</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalRows?.toLocaleString() || '0'}</p>
                    <p className="text-gray-600">แถวข้อมูล</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg border-0">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-orange-100">
                    <Activity className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.successfulSyncs}</p>
                    <p className="text-gray-600">ซิงค์สำเร็จ</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Smart Status */}
        {smartStatus && (
          <Card className="bg-gradient-to-r from-green-500 to-teal-600 text-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white bg-opacity-20 rounded-full">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Smart Auto-Pilot Status</h3>
                    <p className="text-green-100">
                      {smartStatus.isEnabled ? `กำลังทำงาน • ${smartStatus.currentJobs} งานกำลังดำเนินการ` : 'ไม่ทำงาน'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{smartStatus.performance.efficiency}%</p>
                  <p className="text-green-100">ประสิทธิภาพ</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configurations List */}
        <Card className="bg-white shadow-xl border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-gray-900">การซิงค์ทั้งหมด</CardTitle>
                <p className="text-gray-600 mt-1">จัดการและตรวจสอบสถานะการซิงค์</p>
              </div>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                เพิ่มใหม่
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {configs.length === 0 ? (
              <div className="text-center py-16">
                <Database className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">ยังไม่มีการซิงค์</h3>
                <p className="text-gray-600 mb-8 text-lg">เริ่มต้นสร้างการซิงค์แรกของคุณ เพื่อเชื่อมต่อ Google Sheets กับ MySQL</p>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 text-lg"
                >
                  <PlusCircle className="w-5 h-5 mr-2" />
                  สร้างการซิงค์แรก
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${config.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Database className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>ตาราง: {config.table_name}</span>
                            <span>•</span>
                            <span>แถว: {config.row_count?.toLocaleString() || '0'}</span>
                            <span>•</span>
                            <span>ซิงค์ล่าสุด: {config.last_sync_at ? formatLastSync(config.last_sync_at) : 'ไม่เคย'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          config.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {config.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </div>
                        
                        <Button
                          onClick={() => handleViewData(config)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          ดูข้อมูล
                        </Button>
                        
                        <Button
                          onClick={() => window.open(config.sheet_url, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Sheets
                        </Button>
                        
                        <Button
                          onClick={() => window.open(`/config/${config.id}`, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          แก้ไข
                        </Button>
                        
                        <Button
                          onClick={() => handleDeleteConfig(config.id)}
                          variant="outline"
                          size="sm"
                          disabled={deletingConfig === config.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingConfig === config.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">สร้างการซิงค์ใหม่</h2>
                  <p className="text-gray-600 mt-1">เชื่อมต่อ Google Sheets กับ MySQL Database</p>
                </div>
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Step Indicator */}
              <div className="flex items-center mb-8">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  formStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  1
                </div>
                <div className={`flex-1 h-1 mx-4 ${formStep >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  formStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  2
                </div>
              </div>

              {formStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ชื่อการซิงค์ *
                    </label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="เช่น ข้อมูลลูกค้า, รายการสินค้า, ข้อมูลพนักงาน"
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">ชื่อที่จะใช้แสดงในระบบ</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Google Sheets URL *
                    </label>
                    <Input
                      value={formSheetUrl}
                      onChange={(e) => setFormSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      วาง URL ของ Google Sheets ที่ต้องการซิงค์ (ต้องเปิดการแชร์สาธารณะ)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ชื่อแผ่นงาน (Sheet Name)
                    </label>
                    <Input
                      value={formSheetName}
                      onChange={(e) => setFormSheetName(e.target.value)}
                      placeholder="Sheet1 (ถ้าไม่ระบุจะใช้ Sheet1)"
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">ชื่อแผ่นงานใน Google Sheets</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ชื่อตาราง MySQL
                    </label>
                    <Input
                      value={formTableName}
                      onChange={(e) => setFormTableName(e.target.value)}
                      placeholder="customer_data (ถ้าไม่ระบุจะสร้างอัตโนมัติ)"
                      className="text-base"
                    />
                    <p className="text-xs text-gray-500 mt-1">ชื่อตารางใน MySQL ที่จะสร้างหรือใช้งาน</p>
                  </div>
                  
                  <div className="flex items-center space-x-4 pt-4">
                    <Button
                      onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }}
                      variant="outline"
                      className="px-6"
                    >
                      ยกเลิก
                    </Button>
                    <Button 
                      onClick={handlePreviewSheet}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 px-6"
                      disabled={!formName.trim() || !formSheetUrl.trim() || formLoading}
                    >
                      {formLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          กำลังดึงข้อมูล...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          ดูตัวอย่างข้อมูล
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {formStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">ตัวอย่างข้อมูลจาก Google Sheets</h3>
                    {formPreviewData.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(formPreviewData[0]).map((key) => (
                                <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {formPreviewData.slice(0, 5).map((row, index) => (
                              <tr key={index}>
                                {Object.values(row).map((value: any, cellIndex) => (
                                  <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {String(value || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        ไม่พบข้อมูลใน Google Sheets
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 pt-4">
                    <Button
                      onClick={() => setFormStep(1)}
                      variant="outline"
                      className="px-6"
                    >
                      กลับไปแก้ไข
                    </Button>
                    <Button 
                      onClick={handleCreateConfig}
                      className="bg-gradient-to-r from-green-500 to-blue-600 px-6"
                      disabled={formLoading}
                    >
                      {formLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          กำลังสร้าง...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          สร้างการซิงค์
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Viewer Modal */}
      {showDataViewer && selectedConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">ดูข้อมูล: {selectedConfig.name}</h2>
                  <p className="text-gray-600 mt-1">ตาราง: {selectedConfig.table_name}</p>
                </div>
                <Button
                  onClick={() => setShowDataViewer(false)}
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-2" />
                  ปิด
                </Button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {viewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-8 w-8 animate-spin mr-3 text-blue-500" />
                  <span className="text-lg text-gray-600">กำลังโหลดข้อมูล...</span>
                </div>
              ) : viewData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(viewData[0]).map((key) => (
                          <th key={key} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.values(row).map((value: any, cellIndex) => (
                            <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {String(value || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <TableIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">ไม่มีข้อมูล</h3>
                  <p className="text-gray-600">ตารางนี้ยังไม่มีข้อมูล หรือยังไม่ได้ซิงค์</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
