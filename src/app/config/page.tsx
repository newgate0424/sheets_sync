'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Column {
  name: string
  type: string
}

const DATA_TYPES = [
  'VARCHAR(255)',
  'TEXT',
  'INT',
  'BIGINT',
  'DECIMAL(10,2)',
  'DATE',
  'DATETIME',
  'BOOLEAN',
]

export default function ConfigPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Spreadsheet Info
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('')
  const [sheets, setSheets] = useState<any[]>([])

  // Step 2: Sheet Selection
  const [selectedSheet, setSelectedSheet] = useState('')
  const [range, setRange] = useState('')
  const [headers, setHeaders] = useState<string[]>([])

  // Step 3: Schema Configuration
  const [configName, setConfigName] = useState('')
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<Column[]>([])
  const [folder, setFolder] = useState('Default')
  const [folders, setFolders] = useState<string[]>(['Default'])

  const extractSpreadsheetId = (url: string) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : url
  }

  const validateSpreadsheet = async () => {
    setLoading(true)
    try {
      const id = extractSpreadsheetId(spreadsheetUrl)
      const response = await fetch('/api/sheets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: id }),
      })

      const data = await response.json()

      if (data.valid) {
        setSpreadsheetId(id)
        setSpreadsheetTitle(data.title)
        setSheets(data.sheets)
        setStep(2)
      } else {
        alert('ไม่สามารถเข้าถึง Spreadsheet ได้: ' + data.error)
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const loadHeaders = async () => {
    if (!selectedSheet) return

    setLoading(true)
    try {
      const response = await fetch('/api/sheets/headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spreadsheetId, 
          sheetName: selectedSheet 
        }),
      })

      const data = await response.json()

      if (data.success && data.headers.length > 0) {
        setHeaders(data.headers)
        const initialColumns = data.headers.map((header: string) => ({
          name: header,
          type: 'VARCHAR(255)',
        }))
        setColumns(initialColumns)
        
        // สร้างชื่อตารางอัตโนมัติ
        const autoTableName = `sheet_${selectedSheet.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
        setTableName(autoTableName)
        
        setStep(3)
      } else {
        alert('ไม่พบ Header ในชีตนี้')
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!configName || !tableName) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configName,
          spreadsheetId,
          sheetName: selectedSheet,
          range: range || `${selectedSheet}!A:Z`,
          tableName,
          schema: columns,
          folder: folder || 'Default',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('บันทึกการตั้งค่าสำเร็จ!')
        // ใช้ router.push แทน window.location เพื่อให้ Next.js revalidate
        window.location.replace('/dashboard')
      } else {
        alert('เกิดข้อผิดพลาด: ' + data.error)
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium">ลิงค์ชีต</span>
          </div>
          <div className={`w-16 h-1 mx-4 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium">เลือกชีต</span>
          </div>
          <div className={`w-16 h-1 mx-4 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
              3
            </div>
            <span className="ml-2 font-medium">กำหนด Schema</span>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          {/* Step 1: Spreadsheet URL */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">ใส่ลิงค์ Google Sheets</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL ของ Google Sheets
                </label>
                <input
                  type="text"
                  value={spreadsheetUrl}
                  onChange={(e) => setSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  💡 คุณสามารถวาง URL เต็ม หรือ Spreadsheet ID เท่านั้นก็ได้
                </p>
              </div>
              <button
                onClick={validateSpreadsheet}
                disabled={!spreadsheetUrl || loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'กำลังตรวจสอบ...' : 'ถัดไป →'}
              </button>
            </div>
          )}

          {/* Step 2: Select Sheet */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">เลือกชีตและ Range</h2>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  📄 {spreadsheetTitle}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลือกชีต
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- เลือกชีต --</option>
                  {sheets.map((sheet) => (
                    <option key={sheet.sheetId} value={sheet.title}>
                      {sheet.title} ({sheet.rowCount} แถว)
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Range (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="เช่น A1:Z1000 (ถ้าไม่ระบุจะใช้ทั้งชีต)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={loadHeaders}
                  disabled={!selectedSheet || loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  {loading ? 'กำลังโหลด...' : 'ถัดไป →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Schema Configuration */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">กำหนด Schema</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อการตั้งค่า
                </label>
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="เช่น รายการสินค้า"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อตาราง (MySQL)
                </label>
                <input
                  type="text"
                  value={tableName}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                />
                <p className="text-sm text-gray-500 mt-1">
                  ✓ ระบบสร้างชื่อตารางอัตโนมัติให้แล้ว
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📁 โฟลเดอร์
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="ชื่อโฟลเดอร์ (เช่น Default, Sales, HR)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    list="folder-list"
                  />
                  <datalist id="folder-list">
                    {folders.map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  ใช้สำหรับจัดกลุ่มตารางในหน้า Dashboard
                </p>
              </div>

              <h3 className="font-bold text-lg mb-3">คอลัมน์และชนิดข้อมูล</h3>
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {columns.map((col, index) => (
                  <div key={index} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const newColumns = [...columns]
                          newColumns[index].name = e.target.value
                          setColumns(newColumns)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <select
                        value={col.type}
                        onChange={(e) => {
                          const newColumns = [...columns]
                          newColumns[index].type = e.target.value
                          setColumns(newColumns)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {DATA_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium"
                >
                  ← ย้อนกลับ
                </button>
                <button
                  onClick={saveConfig}
                  disabled={!configName || !tableName || loading}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-medium"
                >
                  {loading ? 'กำลังบันทึก...' : '✓ บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
