import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Search, RefreshCw, Download, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface TableRow {
  [key: string]: any;
}

interface TableData {
  configName: string;
  tableName: string;
  columns: string[];
  rows: TableRow[];
  totalRows: number;
  currentPage: number;
  totalPages: number;
}

export default function DataViewPage() {
  const router = useRouter();
  const { configId } = router.query;
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchTableData = async (page: number = 1, search: string = '') => {
    if (!configId) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `/api/data/view?configId=${configId}&page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
        { cache: 'no-store' }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTableData(data.data);
          setCurrentPage(page);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch data');
        }
      } else {
        setError('Failed to fetch table data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (configId) {
      fetchTableData(1, searchTerm);
    }
  }, [configId]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    fetchTableData(1, term);
  };

  const handlePageChange = (page: number) => {
    fetchTableData(page, searchTerm);
  };

  const handleRefresh = () => {
    fetchTableData(currentPage, searchTerm);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-lg text-gray-600">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <Button
            onClick={() => router.push('/')}
            className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับหน้าหลัก
          </Button>
          
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Eye className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">เกิดข้อผิดพลาด</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                ลองใหม่
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <Button
            onClick={() => router.push('/')}
            className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับหน้าหลัก
          </Button>
          
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Eye className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">ไม่พบข้อมูล</h3>
              <p className="text-gray-600">ไม่พบข้อมูลในตารางนี้</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.push('/')}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับหน้าหลัก
            </Button>
            
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {tableData.configName}
              </h1>
              <p className="text-gray-600 mt-1">
                ตาราง: {tableData.tableName} • {tableData.totalRows?.toLocaleString() || '0'} แถว
              </p>
            </div>
          </div>
          
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            รีเฟรช
          </Button>
        </div>

        {/* Search Bar */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาข้อมูล..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {tableData.columns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableData.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-purple-50/50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {(currentPage - 1) * 20 + index + 1}
                    </td>
                    {tableData.columns.map((column) => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row[column] ?? '-'}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 text-blue-600 hover:bg-blue-50"
                          onClick={() => alert(`ดูรายละเอียดแถว ${index + 1}`)}
                          title="ดูรายละเอียด"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 text-green-600 hover:bg-green-50"
                          onClick={() => alert(`แก้ไขแถว ${index + 1}`)}
                          title="แก้ไข"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-2 text-red-600 hover:bg-red-50"
                          onClick={() => alert(`ลบแถว ${index + 1}`)}
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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  แสดง {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, tableData.totalRows)} 
                  จาก {tableData.totalRows?.toLocaleString() || '0'} รายการ
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md">
                    หน้า {currentPage} จาก {tableData.totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= tableData.totalPages}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
