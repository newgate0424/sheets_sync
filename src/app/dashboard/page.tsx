'use client'

// Disable Next.js caching for this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface TableStat {
  id: string
  name: string
  tableName: string
  rowCount: number
  lastSyncedAt?: string
  lastSyncStatus?: string
  folder?: string
}

interface FolderGroup {
  folder: string
  tables: TableStat[]
  count: number
  totalRows: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<TableStat[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [syncingFolder, setSyncingFolder] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [movingConfig, setMovingConfig] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/stats?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [loadStats])

  const handleSync = async (configId: string) => {
    setSyncing(configId)
    const toastId = toast.loading('กำลังซิงค์ข้อมูล...')

    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `ซิงค์สำเร็จ! เพิ่ม: ${data.rowsInserted} | อัปเดต: ${data.rowsUpdated} | ลบ: ${data.rowsDeleted}`,
          { id: toastId, duration: 5000 }
        )
        router.refresh()
        await loadStats()
      } else {
        toast.error('ซิงค์ล้มเหลว: ' + data.error, { id: toastId })
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error, { id: toastId })
    } finally {
      setSyncing(null)
    }
  }

  const getCronUrl = (configId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    // ใช้ค่าจาก environment ถ้ามี ไม่งั้นใช้ placeholder
    const apiKey = process.env.NEXT_PUBLIC_API_SECRET_KEY || 'YOUR_API_SECRET_KEY'
    return `${baseUrl}/api/sync/cron?key=${apiKey}&configId=${configId}`
  }

  const copyCronCommand = (configId: string) => {
    const url = getCronUrl(configId)
    navigator.clipboard.writeText(url)
    toast.success('คัดลอก Cron URL แล้ว!')
  }

  const handleDelete = async (configId: string, tableName: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบตาราง "${tableName}"?\n\nการลบจะไม่สามารถย้อนกลับได้!`)) {
      return
    }

    setDeleting(configId)
    const toastId = toast.loading('กำลังลบตาราง...')

    try {
      const response = await fetch('/api/config/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success('ลบตารางเรียบร้อยแล้ว!', { id: toastId })
        router.refresh()
        await loadStats()
      } else {
        toast.error('ลบล้มเหลว: ' + data.error, { id: toastId })
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error, { id: toastId })
    } finally {
      setDeleting(null)
    }
  }

  const handleMoveToFolder = async (configId: string, currentFolder: string) => {
    const allFolders = Array.from(new Set(stats.map(s => s.folder || 'Default'))).sort()
    const newFolder = prompt(`ย้ายไปโฟลเดอร์:\n\nโฟลเดอร์ที่มี: ${allFolders.join(', ')}\n\nระบุชื่อโฟลเดอร์ใหม่หรือเลือกจากที่มีอยู่:`, currentFolder || 'Default')
    
    if (!newFolder || newFolder === currentFolder) {
      return
    }

    setMovingConfig(configId)
    const toastId = toast.loading('กำลังย้ายโฟลเดอร์...')

    try {
      const response = await fetch('/api/folders/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId, folder: newFolder }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`ย้ายไป "${newFolder}" เรียบร้อย!`, { id: toastId })
        router.refresh()
        await loadStats()
      } else {
        toast.error('ย้ายล้มเหลว: ' + data.error, { id: toastId })
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error, { id: toastId })
    } finally {
      setMovingConfig(null)
    }
  }

  const handleSyncFolder = async (folder: string) => {
    if (!confirm(`คุณต้องการซิงค์ทั้งหมด ${stats.filter(s => (s.folder || 'Default') === folder).length} ตารางใน "${folder}" หรือไม่?`)) {
      return
    }

    setSyncingFolder(folder)
    const toastId = toast.loading(`กำลังซิงค์โฟลเดอร์ ${folder}...`)

    try {
      const response = await fetch('/api/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `ซิงค์โฟลเดอร์สำเร็จ! สำเร็จ: ${data.successCount} | ล้มเหลว: ${data.failedCount}`,
          { id: toastId, duration: 5000 }
        )
        router.refresh()
        await loadStats()
      } else {
        toast.error('ซิงค์ล้มเหลว: ' + data.error, { id: toastId })
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error, { id: toastId })
    } finally {
      setSyncingFolder(null)
    }
  }

  const handleSyncAll = async () => {
    if (!confirm(`คุณต้องการซิงค์ทั้งหมด ${stats.length} ตารางหรือไม่?`)) {
      return
    }

    setSyncingFolder('all')
    const toastId = toast.loading('กำลังซิงค์ทั้งหมด...')

    try {
      const configIds = stats.map(s => s.id)
      const response = await fetch('/api/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configIds }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          `ซิงค์ทั้งหมดสำเร็จ! สำเร็จ: ${data.successCount} | ล้มเหลว: ${data.failedCount}`,
          { id: toastId, duration: 5000 }
        )
        router.refresh()
        await loadStats()
      } else {
        toast.error('ซิงค์ล้มเหลว: ' + data.error, { id: toastId })
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error, { id: toastId })
    } finally {
      setSyncingFolder(null)
    }
  }

  const toggleFolder = (folder: string) => {
    const newCollapsed = new Set(collapsedFolders)
    if (newCollapsed.has(folder)) {
      newCollapsed.delete(folder)
    } else {
      newCollapsed.add(folder)
    }
    setCollapsedFolders(newCollapsed)
  }

  // จัดกลุ่มตาม folder
  const folderGroups: FolderGroup[] = Array.from(
    stats.reduce((acc, stat) => {
      const folder = stat.folder || 'Default'
      if (!acc.has(folder)) {
        acc.set(folder, { folder, tables: [], count: 0, totalRows: 0 })
      }
      const group = acc.get(folder)!
      group.tables.push(stat)
      group.count++
      group.totalRows += stat.rowCount
      return acc
    }, new Map<string, FolderGroup>()).values()
  ).sort((a, b) => a.folder.localeCompare(b.folder))

  // กรองตาม folder ที่เลือก
  const filteredStats = selectedFolder === 'all' 
    ? stats 
    : stats.filter(s => (s.folder || 'Default') === selectedFolder)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f7fa' }}>
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p style={{ color: '#6b7280' }}>กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  const totalRows = stats.reduce((sum: number, stat: TableStat) => sum + stat.rowCount, 0)
  const displayStats = selectedFolder === 'all' ? stats : filteredStats

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 shadow-md border border-orange-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="text-3xl">📁</div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-orange-600">โฟลเดอร์</div>
            </div>
            <div className="text-4xl font-bold mb-1" style={{ color: '#ea580c' }}>
              {folderGroups.length}
            </div>
            <div className="text-sm font-medium" style={{ color: '#9a3412' }}>
              กลุ่มข้อมูล
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 shadow-md border border-purple-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="text-3xl">📊</div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-purple-600">ตาราง</div>
            </div>
            <div className="text-4xl font-bold mb-1" style={{ color: '#7c3aed' }}>
              {stats.length}
            </div>
            <div className="text-sm font-medium" style={{ color: '#5b21b6' }}>
              ตารางทั้งหมด
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 shadow-md border border-green-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="text-3xl">💾</div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-green-600">ข้อมูล</div>
            </div>
            <div className="text-4xl font-bold mb-1" style={{ color: '#16a34a' }}>
              {totalRows > 999 ? `${(totalRows/1000).toFixed(1)}k` : totalRows}
            </div>
            <div className="text-sm font-medium" style={{ color: '#15803d' }}>
              {totalRows.toLocaleString()} แถว
            </div>
          </div>
          <Link href="/config" className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 shadow-md border-2 border-dashed border-blue-300 hover:shadow-lg hover:border-blue-400 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="text-3xl group-hover:scale-110 transition-transform">➕</div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-white text-blue-600">สร้างใหม่</div>
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: '#2563eb' }}>
              เพิ่มตาราง
            </div>
            <div className="text-sm font-medium" style={{ color: '#1e40af' }}>
              คลิกเพื่อเริ่มต้น →
            </div>
          </Link>
        </div>

        {/* Folder Filter & Bulk Actions */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔍</div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">กรองตามโฟลเดอร์</div>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium hover:border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                >
                  <option value="all">📂 ทั้งหมด ({stats.length} ตาราง)</option>
                  {folderGroups.map(group => (
                    <option key={group.folder} value={group.folder}>
                      📁 {group.folder} ({group.count} ตาราง)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              {selectedFolder !== 'all' && (
                <button
                  onClick={() => handleSyncFolder(selectedFolder)}
                  disabled={syncingFolder === selectedFolder}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-md hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  {syncingFolder === selectedFolder ? '⏳ กำลังซิงค์...' : `🔄 ซิงค์ ${selectedFolder}`}
                </button>
              )}
              <button
                onClick={handleSyncAll}
                disabled={syncingFolder === 'all'}
                className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-md hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                {syncingFolder === 'all' ? '⏳ กำลังซิงค์...' : '⚡ ซิงค์ทั้งหมด'}
              </button>
            </div>
          </div>
        </div>

        {/* Tables List */}
        <div className="space-y-4">
          {folderGroups.map((group) => {
            const isCollapsed = collapsedFolders.has(group.folder)
            const groupTables = group.tables

            return (
              <div key={group.folder} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
                {/* Folder Header */}
                <div 
                  className="px-6 py-5 border-b cursor-pointer hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all"
                  style={{ borderColor: '#e5e7eb' }}
                  onClick={() => toggleFolder(group.folder)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl transition-transform" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(15deg)' }}>
                        {isCollapsed ? '📁' : '📂'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1" style={{ color: '#1f2937' }}>
                          {group.folder}
                        </h3>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="px-3 py-1 rounded-full font-semibold" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                            📊 {group.count} ตาราง
                          </span>
                          <span className="px-3 py-1 rounded-full font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>
                            💾 {group.totalRows.toLocaleString()} แถว
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSyncFolder(group.folder)
                        }}
                        disabled={syncingFolder === group.folder}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-md"
                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                      >
                        {syncingFolder === group.folder ? '⏳' : '🔄'} ซิงค์โฟลเดอร์
                      </button>
                      <div className="text-2xl text-gray-400 transition-transform" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tables in Folder */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            ชื่อตาราง
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            ชื่อเทคนิค
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            จำนวนแถว
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            ซิงค์ล่าสุด
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            สถานะ
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                            จัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupTables.map((stat) => (
                          <tr
                            key={stat.id}
                            className="border-b transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#e5e7eb' }}
                          >
                            <td className="px-6 py-4">
                              <div className="font-semibold" style={{ color: '#1f2937' }}>
                                {stat.name}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-xs px-2 py-1 rounded" style={{ background: '#f3f4f6', color: '#374151' }}>
                                {stat.tableName}
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-lg font-bold" style={{ color: '#10b981' }}>
                                {stat.rowCount.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm" style={{ color: '#6b7280' }}>
                                {stat.lastSyncedAt
                                  ? new Date(stat.lastSyncedAt).toLocaleString('th-TH')
                                  : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {stat.lastSyncStatus === 'success' ? (
                                <span className="badge badge-success">สำเร็จ</span>
                              ) : stat.lastSyncStatus === 'failed' ? (
                                <span className="badge badge-error">ล้มเหลว</span>
                              ) : stat.lastSyncStatus === 'running' ? (
                                <span className="badge badge-warning">กำลังซิงค์</span>
                              ) : (
                                <span className="badge badge-info">ยังไม่ซิงค์</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2 flex-wrap">
                                <Link
                                  href={`/tables?table=${stat.tableName}`}
                                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 shadow-sm hover:shadow-md"
                                  style={{ background: '#f3f4f6', color: '#374151' }}
                                >
                                  👁️ ดูข้อมูล
                                </Link>
                                <button
                                  onClick={() => handleSync(stat.id)}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    copyCronCommand(stat.id)
                                  }}
                                  disabled={syncing === stat.id || deleting === stat.id || movingConfig === stat.id}
                                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-sm hover:shadow-md"
                                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                                  title="คลิกซ้ายเพื่อซิงค์ | คลิกขวาคัดลอก Cron URL"
                                >
                                  {syncing === stat.id ? '⏳' : '🔄'}
                                </button>
                                <button
                                  onClick={() => handleMoveToFolder(stat.id, stat.folder || 'Default')}
                                  disabled={syncing === stat.id || deleting === stat.id || movingConfig === stat.id}
                                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-sm hover:shadow-md"
                                  style={{ background: '#f59e0b' }}
                                  title="ย้ายโฟลเดอร์"
                                >
                                  {movingConfig === stat.id ? '⏳' : '📁'}
                                </button>
                                <button
                                  onClick={() => handleDelete(stat.id, stat.tableName)}
                                  disabled={syncing === stat.id || deleting === stat.id || movingConfig === stat.id}
                                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 shadow-sm hover:shadow-md"
                                  style={{ background: '#ef4444' }}
                                  title="ลบตาราง"
                                >
                                  {deleting === stat.id ? '⏳' : '🗑️'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {stats.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <p className="text-lg mb-4" style={{ color: '#6b7280' }}>
                ยังไม่มีตารางในระบบ
              </p>
              <Link
                href="/config"
                className="inline-block px-6 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                เพิ่มตารางแรก
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
