import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';

interface SyncConfig {
  id: number;
  name: string;
  sheet_url: string;
  sheet_name: string;
  table_name: string;
  columns: { [key: string]: string };
  is_active: boolean;
  last_sync_at?: string;
  row_count: number;
}

function EditConfigPage() {
  const router = useRouter();
  const { id } = router.query;
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      const response = await fetch(`/api/sync-configs/${id}`);
      if (!response.ok) {
        throw new Error('ไม่พบการตั้งค่า');
      }
      
      const data = await response.json();
      setConfig(data);
      setName(data.name);
      setSheetUrl(data.sheet_url);
      setIsActive(data.is_active);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/sync-configs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          sheet_url: sheetUrl,
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('ไม่สามารถบันทึกการตั้งค่าได้');
      }

      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error && !config) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto pt-8">
          <div className="border-red-200 bg-red-50 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-600">เกิดข้อผิดพลาด</h2>
            <p className="mb-6 text-red-600">{error}</p>
            <Link href="/">
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                กลับหน้าหลัก
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/">
            <button className="mr-4 px-3 py-1 text-blue-600 hover:bg-blue-50 transition-colors rounded">
              ← กลับหน้าหลัก
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แก้ไขการตั้งค่า Sync</h1>
            <p className="text-gray-600">จัดการการซิงโครไนซ์ข้อมูลระหว่าง Google Sheets และ MySQL</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {config && (
          <div className="bg-white shadow-lg rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              ข้อมูลการตั้งค่า: {config.name}
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อการตั้งค่า
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ข้อมูลลูกค้า"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheets URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เปิดใช้งานการซิงโครไนซ์
                  </span>
                </label>
              </div>

              <div className="flex items-center space-x-4 pt-6">
                <button 
                  onClick={handleSave} 
                  disabled={saving} 
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-md disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
                <Link href="/">
                  <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                    ยกเลิก
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default EditConfigPage;