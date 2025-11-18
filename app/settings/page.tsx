'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Check, X, AlertCircle } from 'lucide-react';

function SettingsPageContent() {
  const router = useRouter();
  const [connectionString, setConnectionString] = useState('');
  const [currentConnection, setCurrentConnection] = useState('');
  const [dbType, setDbType] = useState<'mysql' | 'postgresql'>('postgresql');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    checkAuth();
    fetchCurrentConnection();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.user?.role !== 'admin') {
        router.push('/database');
      }
    } catch {
      router.push('/login');
    }
  };

  const fetchCurrentConnection = async () => {
    try {
      const response = await fetch('/api/settings/database');
      if (response.ok) {
        const data = await response.json();
        setCurrentConnection(data.connectionString);
        setConnectionString(data.connectionString);
        
        // Auto-detect database type from connection string
        if (data.original) {
          if (data.original.startsWith('mysql://')) {
            setDbType('mysql');
          } else {
            setDbType('postgresql');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching connection:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTestConnection = async () => {
    if (!connectionString.trim()) {
      showToast('กรุณากรอก Connection String', 'error');
      return;
    }

    // ตรวจสอบว่า connection string ตรงกับ database type
    if (dbType === 'postgresql' && !connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
      showToast('PostgreSQL Connection String ต้องเริ่มต้นด้วย postgresql:// หรือ postgres://', 'error');
      return;
    }
    
    if (dbType === 'mysql' && !connectionString.startsWith('mysql://')) {
      showToast('MySQL Connection String ต้องเริ่มต้นด้วย mysql://', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString, dbType })
      });

      const data = await response.json();
      setTestResult({
        success: response.ok,
        message: data.message || data.error
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!testResult?.success) {
      showToast('กรุณาทดสอบการเชื่อมต่อก่อนบันทึก', 'error');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/settings/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString, dbType })
      });

      if (response.ok) {
        const data = await response.json();
        
        // แสดงผลการ migrate
        if (data.migration) {
          const { created, existed, errors } = data.migration.results;
          let message = 'บันทึกการตั้งค่าสำเร็จ';
          
          if (created.length > 0) {
            message += `\n✓ สร้างตาราง: ${created.join(', ')}`;
          }
          if (existed.length > 0) {
            message += `\n✓ ตารางที่มีอยู่แล้ว: ${existed.join(', ')}`;
          }
          if (errors.length > 0) {
            message += `\n⚠ ตารางที่มีปัญหา: ${errors.map((e: any) => e.table).join(', ')}`;
          }
          
          showToast(message, errors.length > 0 ? 'info' : 'success');
        } else {
          showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
        }
        
        setCurrentConnection(connectionString);
        setTestResult(null);
        
        // Reload page after 2 seconds if server needs restart
        if (data.needsReload) {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } else {
        const data = await response.json();
        showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถบันทึกการตั้งค่าได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  const parseConnectionString = (connStr: string) => {
    try {
      const url = new URL(connStr);
      return {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.slice(1),
        username: url.username
      };
    } catch {
      return null;
    }
  };

  const currentInfo = parseConnectionString(currentConnection);
  const newInfo = parseConnectionString(connectionString);

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">การตั้งค่าฐานข้อมูล PostgreSQL</h1>
          </div>

          {/* Current Connection Info */}
          {currentInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">การเชื่อมต่อปัจจุบัน:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Host:</span> <span className="font-mono">{currentInfo.host}</span></div>
                <div><span className="text-gray-600">Port:</span> <span className="font-mono">{currentInfo.port}</span></div>
                <div><span className="text-gray-600">Database:</span> <span className="font-mono">{currentInfo.database}</span></div>
                <div><span className="text-gray-600">User:</span> <span className="font-mono">{currentInfo.username}</span></div>
              </div>
            </div>
          )}

          {/* Database Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ประเภทฐานข้อมูล
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="postgresql"
                  checked={dbType === 'postgresql'}
                  onChange={(e) => {
                    setDbType(e.target.value as 'postgresql');
                    setConnectionString('');
                    setTestResult(null);
                  }}
                  className="mr-2"
                />
                <span>PostgreSQL</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="mysql"
                  checked={dbType === 'mysql'}
                  onChange={(e) => {
                    setDbType(e.target.value as 'mysql');
                    setConnectionString('');
                    setTestResult(null);
                  }}
                  className="mr-2"
                />
                <span>MySQL</span>
              </label>
            </div>
          </div>

          {/* Connection String Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'} Connection String
            </label>
            <input
              type="text"
              value={connectionString}
              onChange={(e) => {
                setConnectionString(e.target.value);
                setTestResult(null);
              }}
              placeholder={
                dbType === 'postgresql' 
                  ? "postgresql://username:password@host:5432/database"
                  : "mysql://username:password@host:3306/database"
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              รูปแบบ: {dbType}://[username]:[password]@[host]:{dbType === 'postgresql' ? '5432' : '3306'}/[database]
            </p>
          </div>

          {/* New Connection Info Preview */}
          {newInfo && connectionString !== currentConnection && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">ตัวอย่างการเชื่อมต่อใหม่:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-blue-700">Host:</span> <span className="font-mono text-blue-900">{newInfo.host}</span></div>
                <div><span className="text-blue-700">Port:</span> <span className="font-mono text-blue-900">{newInfo.port}</span></div>
                <div><span className="text-blue-700">Database:</span> <span className="font-mono text-blue-900">{newInfo.database}</span></div>
                <div><span className="text-blue-700">User:</span> <span className="font-mono text-blue-900">{newInfo.username}</span></div>
              </div>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
              testResult.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.success ? (
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                  {testResult.success ? 'เชื่อมต่อสำเร็จ!' : 'เชื่อมต่อไม่สำเร็จ'}
                </p>
                <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">คำเตือน:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>การเปลี่ยนฐานข้อมูลจะมีผลทันทีหลังจากบันทึก</li>
                <li>กรุณาแน่ใจว่าฐานข้อมูลใหม่มีตารางและข้อมูลที่จำเป็น</li>
                <li>ควรสำรองข้อมูลก่อนเปลี่ยนฐานข้อมูล</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing || !connectionString.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !testResult?.success || connectionString === currentConnection}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          } text-white whitespace-pre-line`}>
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  return <SettingsPageContent />;
}
