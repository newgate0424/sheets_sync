'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface TableData {
  [key: string]: any
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function TablesPage() {
  const searchParams = useSearchParams()
  const initialTable = searchParams.get('table') || ''

  const [tables, setTables] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState(initialTable)
  const [data, setData] = useState<TableData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchColumn, setSearchColumn] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      loadTableData(1)
    }
  }, [selectedTable])

  const loadTables = async () => {
    try {
      const response = await fetch('/api/stats')
      const stats = await response.json()
      setTables(stats)
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  const loadTableData = async (page: number) => {
    if (!selectedTable) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        tableName: selectedTable,
        page: page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
        params.append('searchColumn', searchColumn)
      }

      const response = await fetch(`/api/tables/data?${params.toString()}`)
      const result = await response.json()

      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setData(result.data)
        setPagination(result.pagination)
        
        // ดึงชื่อคอลัมน์จากแถวแรก
        const cols = Object.keys(result.data[0]).filter(
          col => !['id', 'row_index', 'created_at', 'updated_at'].includes(col)
        )
        setColumns(cols)
      } else {
        setData([])
        setColumns([])
      }
    } catch (error) {
      console.error('Error loading table data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadTableData(1)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchColumn('all')
    // Reload data without search
    if (selectedTable) {
      loadTableData(1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Table Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เลือกตาราง
          </label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- เลือกตาราง --</option>
            {tables.map((table) => (
              <option key={table.tableName} value={table.tableName}>
                {table.name} ({table.rowCount.toLocaleString()} แถว)
              </option>
            ))}
          </select>
        </div>

        {/* Data Table */}
        {selectedTable && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTable}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    แสดง {data.length} จาก {pagination.total.toLocaleString()} แถว
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  หน้า {pagination.page} / {pagination.totalPages}
                </div>
              </div>

              {/* Search Box */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    placeholder="ค้นหาข้อมูล... (กด Enter เพื่อค้นหา)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="w-48">
                  <select
                    value={searchColumn}
                    onChange={(e) => setSearchColumn(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">ค้นหาทุกคอลัมน์</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  🔍 ค้นหา
                </button>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    ✕ ล้าง
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่พบข้อมูลในตารางนี้'}
                </p>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ล้างการค้นหา
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          #
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {row.row_index || idx + 1}
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate"
                              title={String(row[col] || '')}
                            >
                              {row[col] !== null && row[col] !== undefined 
                                ? String(row[col]) 
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => loadTableData(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    ← ก่อนหน้า
                  </button>
                  
                  <div className="text-sm text-gray-700">
                    หน้า <span className="font-medium">{pagination.page}</span> จาก{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </div>
                  
                  <button
                    onClick={() => loadTableData(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    ถัดไป →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
