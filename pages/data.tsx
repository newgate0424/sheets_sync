import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft, 
  RefreshCw, 
  Database, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Search, 
  Download, 
  Filter, 
  Table, 
  Menu, 
  X,
  FileSpreadsheet,
  Activity,
  Clock,
  Trash2
} from 'lucide-react';

interface TableData {
  configId: number;
  configName: string;
  tableName: string;
  totalRows: number;
  columns: string[];
  rows: any[];  // เปลี่ยนจาก data เป็น rows
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

interface SyncConfig {
  id: number;
  name: string;
  table_name: string;
  is_active: boolean;
  row_count: number;
  last_sync_at: string;
}

export default function DataViewPage() {
  const router = useRouter();
  const { configId } = router.query;
  
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingTable, setDeletingTable] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (configId) {
      setSelectedConfig(Number(configId));
    }
  }, [configId]);

  useEffect(() => {
    if (selectedConfig) {
      fetchTableData(selectedConfig, currentPage);
    }
  }, [selectedConfig, currentPage, pageSize]);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/sync-configs');
      const data = await response.json();
      
      // API returns array directly, not wrapped in 'configs' property
      const configsArray = Array.isArray(data) ? data : (data.configs || []);
      setConfigs(configsArray);
      
      // Auto-select first config if none selected
      if (configsArray.length > 0 && !selectedConfig) {
        setSelectedConfig(configsArray[0].id);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      setError('Failed to fetch configurations');
    }
    setLoading(false);
  };

  const fetchTableData = async (configId: number, page: number = 1) => {
    setDataLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/data/view?configId=${configId}&page=${page}&pageSize=${pageSize}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        setTableData(result.data);
        setCurrentPage(page);
      } else {
        setError(result.message || 'Failed to fetch table data');
        setTableData(null);
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
      setError('Network error occurred');
      setTableData(null);
    }
    setDataLoading(false);
  };

  const handleConfigChange = (configId: number) => {
    setSelectedConfig(configId);
    setCurrentPage(1);
    router.push(`/data?configId=${configId}`, undefined, { shallow: true });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= (tableData?.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  const handleDeleteTable = async (tableName: string, configId: number) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่ต้องการลบตาราง "${tableName}"? การกระทำนี้ไม่สามารถย้อนกลับได้!`)) {
      return;
    }

    setDeletingTable(tableName);
    try {
      const response = await fetch('/api/tables/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ table_name: tableName })
      });

      const result = await response.json();

      if (response.ok) {
        // Remove config from list
        setConfigs(prevConfigs => prevConfigs.filter(config => config.id !== configId));
        
        // Clear selected config if it was the deleted one
        if (selectedConfig === configId) {
          setSelectedConfig(null);
          setTableData(null);
        }

        alert(`ลบตาราง "${tableName}" เรียบร้อยแล้ว`);
      } else {
        throw new Error(result.error || 'Failed to delete table');
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      alert(`เกิดข้อผิดพลาดในการลบตาราง: ${(error as Error).message}`);
    } finally {
      setDeletingTable(null);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'string' && value.length > 0) {
      // MySQL datetime format (YYYY-MM-DD HH:mm:ss)
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        const date = new Date(value + 'Z');
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${day}/${month}/${year + 543} ${hours}:${minutes}`;
      }
      
      // MySQL date format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${day}/${month}/${parseInt(year) + 543}`;
      }
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString('th-TH');
    }
    
    return String(value);
  };

  const filteredData = tableData?.rows.filter(row =>
    tableData.columns.some(column =>
      String(row[column] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Loading configurations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Modern Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-16'} transition-all duration-300 flex-shrink-0`}>
          <div className="bg-white rounded-3xl shadow-soft border border-gray-100 h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                {sidebarOpen ? (
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <Database className="h-5 w-5 mr-3 text-blue-600" />
                        Data Sources
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{configs.length} configurations available</p>
                    </div>
                    <Button
                      onClick={() => setSidebarOpen(false)}
                      variant="ghost"
                      size="sm"
                      className="p-2 hover:bg-gray-50 rounded-xl"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setSidebarOpen(true)}
                    variant="ghost"
                    size="sm"
                    className="p-2 hover:bg-gray-50 rounded-xl mx-auto"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto h-full">
              {sidebarOpen && (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      onClick={() => handleConfigChange(config.id)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 group ${
                        selectedConfig === config.id
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-xl transition-colors ${
                          selectedConfig === config.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-500'
                        }`}>
                          <Table className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-sm truncate ${
                            selectedConfig === config.id ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {config.name}
                          </h4>
                          <p className="text-xs text-gray-500 truncate mt-1">{config.table_name}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              config.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {config.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-400 font-medium">
                                {config.row_count.toLocaleString()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTable(config.table_name, config.id);
                                }}
                                disabled={deletingTable === config.table_name}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`ลบตาราง ${config.table_name}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {config.last_sync_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Last sync: {new Date(config.last_sync_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {!selectedConfig ? (
            <div className="bg-white rounded-3xl shadow-soft border border-gray-100 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileSpreadsheet className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Data Source</h3>
                <p className="text-gray-500">Choose a configuration from the sidebar to view its data</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-soft border border-gray-100 h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {tableData?.configName || 'Loading...'}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {tableData ? (
                        <>Table: {tableData.tableName} • {tableData.totalRows.toLocaleString()} total rows</>
                      ) : (
                        'Loading table data...'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button
                      onClick={() => selectedConfig && fetchTableData(selectedConfig, currentPage)}
                      disabled={dataLoading}
                      variant="outline"
                      className="px-4 py-2 rounded-xl"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Link href="/">
                      <Button variant="outline" className="px-4 py-2 rounded-xl">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Search and Controls */}
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-80 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-auto">
                {dataLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-gray-600">Loading table data...</p>
                    </div>
                  </div>
                ) : tableData && filteredData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {tableData.columns.map((column, index) => (
                            <th
                              key={index}
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            {tableData.columns.map((column, colIndex) => (
                              <td
                                key={colIndex}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100"
                              >
                                {formatValue(row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Database className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Found</h3>
                      <p className="text-gray-500">
                        {searchTerm ? 'No results match your search criteria' : 'This table appears to be empty'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {tableData && tableData.totalPages > 1 && !searchTerm && (
                <div className="p-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Showing page {currentPage} of {tableData.totalPages} 
                      ({tableData.totalRows.toLocaleString()} total rows)
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="px-3 py-2 rounded-xl"
                      >
                        First
                      </Button>
                      <Button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="px-3 py-2 rounded-xl"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-4 py-2 text-sm font-medium text-gray-700">
                        {currentPage}
                      </span>
                      <Button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === tableData.totalPages}
                        variant="outline"
                        size="sm"
                        className="px-3 py-2 rounded-xl"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handlePageChange(tableData.totalPages)}
                        disabled={currentPage === tableData.totalPages}
                        variant="outline"
                        size="sm"
                        className="px-3 py-2 rounded-xl"
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
