import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, FileSpreadsheet, Database, Plus, Trash2, Eye, Settings, Zap } from 'lucide-react';

interface ColumnMapping {
  googleColumn: string;
  mysqlColumn: string;
  dataType: 'VARCHAR(255)' | 'VARCHAR(500)' | 'VARCHAR(1000)' | 'TEXT' | 'LONGTEXT' | 'INT' | 'BIGINT' | 'SMALLINT' | 'TINYINT' | 'DECIMAL(10,2)' | 'DECIMAL(15,4)' | 'FLOAT' | 'DOUBLE' | 'DATETIME' | 'DATE' | 'TIME' | 'TIMESTAMP' | 'BOOLEAN' | 'JSON' | 'CHAR(10)';
}

interface SheetPreviewData {
  data: string[][];
}

// Helper function to suggest data type based on column name
const suggestDataType = (columnName: string, sampleValue?: string): ColumnMapping['dataType'] => {
  const name = columnName.toLowerCase();
  
  // Check for common patterns
  if (name.includes('id') || name.includes('count') || name.includes('number')) {
    return 'INT';
  }
  if (name.includes('price') || name.includes('amount') || name.includes('cost')) {
    return 'DECIMAL(10,2)';
  }
  if (name.includes('date') || name.includes('created') || name.includes('updated')) {
    return 'DATETIME';
  }
  if (name.includes('email') || name.includes('url') || name.includes('link')) {
    return 'VARCHAR(255)';
  }
  if (name.includes('description') || name.includes('content') || name.includes('text')) {
    return 'TEXT';
  }
  if (name.includes('phone') || name.includes('mobile')) {
    return 'VARCHAR(255)';
  }
  if (name.includes('json') || name.includes('data')) {
    return 'JSON';
  }
  
  // Check sample value if provided
  if (sampleValue) {
    const value = sampleValue.toString();
    if (!isNaN(Number(value)) && value.includes('.')) {
      return 'DECIMAL(10,2)';
    }
    if (!isNaN(Number(value)) && !value.includes('.')) {
      return 'INT';
    }
    if (value.length > 255) {
      return 'TEXT';
    }
  }
  
  // Default
  return 'VARCHAR(255)';
};

export default function ConfigPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [configName, setConfigName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [tableName, setTableName] = useState('');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([
    { googleColumn: '', mysqlColumn: '', dataType: 'VARCHAR(255)' }
  ]);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [testResult, setTestResult] = useState<any>(null);

  const validateSheetUrl = (url: string) => {
    const pattern = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    return pattern.test(url);
  };

  const suggestDataType = (columnName: string, googleColumn: string): string => {
    const name = (columnName + googleColumn).toLowerCase();
    
    // Date/Time patterns
    if (name.includes('date') || name.includes('created') || name.includes('updated') || name.includes('birth')) {
      return 'DATETIME';
    }
    if (name.includes('time')) return 'TIME';
    
    // Number patterns  
    if (name.includes('id') || name.includes('count') || name.includes('number') || name.includes('age')) {
      return 'INT';
    }
    if (name.includes('price') || name.includes('amount') || name.includes('cost') || name.includes('salary')) {
      return 'DECIMAL(10,2)';
    }
    
    // Boolean patterns
    if (name.includes('is_') || name.includes('has_') || name.includes('active') || name.includes('enable')) {
      return 'BOOLEAN';
    }
    
    // Email patterns
    if (name.includes('email') || name.includes('mail')) {
      return 'VARCHAR(255)';
    }
    
    // Text patterns
    if (name.includes('description') || name.includes('comment') || name.includes('note') || name.includes('message')) {
      return 'TEXT';
    }
    
    // Phone patterns
    if (name.includes('phone') || name.includes('tel') || name.includes('mobile')) {
      return 'VARCHAR(255)';
    }
    
    // JSON patterns
    if (name.includes('json') || name.includes('meta') || name.includes('config')) {
      return 'JSON';
    }
    
    // Default
    return 'VARCHAR(255)';
  };

  const autoFillColumns = () => {
    console.log('AutoFill called, previewData:', previewData);
    if (!previewData || previewData.length === 0) {
      // Create default A-J mapping if no preview data
      const defaultMappings = ['A', 'B', 'C', 'D', 'E'].map((letter, index) => ({
        googleColumn: letter,
        mysqlColumn: `column_${letter.toLowerCase()}`,
        dataType: 'VARCHAR(255)' as any
      }));
      
      setColumnMappings(defaultMappings);
      alert('สร้าง Column Mapping เริ่มต้นแล้ว (Column A-E)\nกรุณาปรับแต่ง MySQL column names ตามต้องการ');
      return;
    }
    
    const firstRow = previewData[0];
    console.log('First row for autofill:', firstRow);
    
    if (!firstRow || firstRow.length === 0) {
      alert('ไม่พบข้อมูลในแถวแรก');
      return;
    }

    // Check if first row looks like headers (contains text, not just numbers)
    const hasHeaderRow = firstRow.some((cell, index) => {
      const cellStr = String(cell || '').trim();
      // If cell is empty, numeric only, or very short, probably not a header
      return cellStr.length > 1 && !/^\d+\.?\d*$/.test(cellStr);
    });
    
    let newMappings;
    
    if (hasHeaderRow) {
      // Use first row as headers
      console.log('Detected header row, using as column names');
      newMappings = firstRow.map((header, index) => {
        const headerStr = String(header || '').trim();
        const mysqlColumn = headerStr
          ? headerStr.toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '')
          : `column_${index + 1}`;
          
        return {
          googleColumn: headerStr || `Column ${String.fromCharCode(65 + index)}`,
          mysqlColumn: mysqlColumn || `column_${index + 1}`,
          dataType: suggestDataType(mysqlColumn, headerStr) as any
        };
      });
      alert(`สร้าง Column Mapping จาก Header Row แล้ว (${newMappings.length} columns)`);
    } else {
      // Use A, B, C... format
      console.log('No header row detected, using A, B, C... format');
      newMappings = firstRow.map((_, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C, D...
        return {
          googleColumn: letter,
          mysqlColumn: `column_${letter.toLowerCase()}`,
          dataType: 'VARCHAR(255)' as any
        };
      });
      alert(`สร้าง Column Mapping แบบ A, B, C... แล้ว (${newMappings.length} columns)\nกรุณาปรับแต่ง MySQL column names ตามต้องการ`);
    }
    
    console.log('New mappings created:', newMappings);
    setColumnMappings(newMappings);
  };

  const handleGetSheetInfo = async () => {
    if (!sheetUrl || !validateSheetUrl(sheetUrl)) {
      setError('กรุณาใส่ URL ของ Google Sheets ที่ถูกต้อง');
      return;
    }

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      // ทดสอบการเชื่อมต่อก่อน
      const testResponse = await fetch('/api/google/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheet_url: sheetUrl }),
      });

      const testData = await testResponse.json();

      if (!testData.success) {
        setError(`ไม่สามารถเชื่อมต่อกับ Google Sheets ได้: ${testData.error}`);
        setTestResult(testData);
        return;
      }

      setTestResult(testData);
      setAvailableSheets(testData.sheets);
      setStep(2);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewSheet = async () => {
    if (!selectedSheet) {
      setError('กรุณาเลือก Sheet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Fetching preview data for:', {
        sheet_url: sheetUrl,
        sheet_name: selectedSheet
      });

      const response = await fetch('/api/sheets/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheet_url: sheetUrl,
          sheet_name: selectedSheet,
          range: 'A1:Z20'
        }),
      });

      const data = await response.json();
      console.log('Preview API response:', data);

      if (response.ok) {
        console.log('Preview data received:', data);
        if (data.data && data.data.length > 0) {
          console.log('Setting preview data:', data.data);
          console.log('Headers found:', data.data[0]);
          setPreviewData(data.data);
          // Auto-create initial column mappings from headers
          const headers = data.data[0];
          const initialMappings = headers.map((header: string) => ({
            googleColumn: header,
            mysqlColumn: header.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            dataType: suggestDataType(header, headers.length > 1 ? data.data[1]?.[headers.indexOf(header)] : undefined)
          }));
          console.log('Created initial mappings:', initialMappings);
          setColumnMappings(initialMappings);
          setStep(3);
        } else {
          console.error('No data found in response:', data);
          setError('ไม่พบข้อมูลใน Sheet นี้ กรุณาตรวจสอบว่า Sheet มีข้อมูลหรือไม่');
        }
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูล Preview ได้');
        console.error('API error:', data);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddColumnMapping = () => {
    setColumnMappings([
      ...columnMappings,
      { googleColumn: '', mysqlColumn: '', dataType: 'VARCHAR(255)' }
    ]);
  };

  const handleRemoveColumnMapping = (index: number) => {
    if (columnMappings.length > 1) {
      setColumnMappings(columnMappings.filter((_, i) => i !== index));
    }
  };

  const handleColumnMappingChange = (index: number, field: keyof ColumnMapping, value: string) => {
    const newMappings = [...columnMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    
    // Auto-suggest data type when column names change
    if (field === 'googleColumn' || field === 'mysqlColumn') {
      const suggestedType = suggestDataType(newMappings[index].mysqlColumn, newMappings[index].googleColumn);
      newMappings[index].dataType = suggestedType as any;
    }
    
    setColumnMappings(newMappings);
  };

  const handleCreateTable = async () => {
    if (!tableName) {
      setError('กรุณาใส่ชื่อตาราง');
      return;
    }

    if (columnMappings.some(m => !m.googleColumn || !m.mysqlColumn)) {
      setError('กรุณากรอกข้อมูล Column Mapping ให้ครบถ้วน');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tables/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: tableName,
          columns: columnMappings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ไม่สามารถสร้างตารางได้');
      }

      // Save configuration to database
      console.log('Creating config with mappings:', 
        columnMappings.map(m => [m.googleColumn, m.mysqlColumn])
      );

      const configResponse = await fetch('/api/sync-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: configName,
          sheet_url: sheetUrl,
          sheet_name: selectedSheet,
          table_name: tableName,
          columns: columnMappings.reduce((acc: any, mapping) => {
            acc[mapping.googleColumn] = mapping.mysqlColumn;
            return acc;
          }, {}),
        }),
      });

      if (!configResponse.ok) {
        const errorData = await configResponse.json();
        throw new Error(errorData.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
      }

      // Success! Redirect to dashboard
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">{/* Back Button */}
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-4 hover:bg-blue-50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าหลัก
            </Button>
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mr-4 shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">เพิ่มการตั้งค่าใหม่</h2>
            <p className="text-gray-600 text-sm mt-1">
              สร้างการตั้งค่าการซิงค์ข้อมูลจาก Google Sheets ไปยัง MySQL
            </p>
          </div>
        </div>
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    step >= stepNumber
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div className={`h-1 w-32 mx-4 transition-all duration-300 ${
                    step > stepNumber ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-sm font-medium">
            <span className={step >= 1 ? 'text-blue-600' : 'text-gray-500'}>เชื่อมต่อ Sheets</span>
            <span className={step >= 2 ? 'text-blue-600' : 'text-gray-500'}>เลือก Sheet</span>
            <span className={step >= 3 ? 'text-blue-600' : 'text-gray-500'}>ตั้งค่าตาราง</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Step 1: Google Sheets Connection */}
        {step === 1 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-white">
                <FileSpreadsheet className="h-6 w-6 mr-3" />
                เชื่อมต่อกับ Google Sheets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ชื่อการตั้งค่า
                </label>
                <Input
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="เช่น ข้อมูลลูกค้า, ยอดขาย"
                  className="text-lg p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  URL ของ Google Sheets
                </label>
                <Input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="text-lg p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 transition-colors"
                />
                <p className="text-sm text-gray-500 mt-2">
                  💡 คัดลอก URL จาก address bar ของ Google Sheets
                </p>
              </div>

              {testResult && !testResult.success && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 mb-2">ข้อมูลการทดสอบ:</p>
                  <pre className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}

              <Button
                onClick={handleGetSheetInfo}
                disabled={loading || !configName || !sheetUrl}
                className="w-full py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
              >
                {loading ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อกับ Google Sheets'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Sheet Selection */}
        {step === 2 && (
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-white">
                <Eye className="h-6 w-6 mr-3" />
                เลือก Sheet ที่ต้องการซิงค์
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Sheets ที่พบใน Google Spreadsheet
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableSheets.map((sheet, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedSheet(sheet)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedSheet === sheet
                          ? 'border-purple-500 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                      }`}
                    >
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-5 w-5 text-purple-600 mr-3" />
                        <span className="font-medium text-gray-900">{sheet}</span>
                        {selectedSheet === sheet && (
                          <span className="ml-auto text-purple-600">✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3"
                >
                  ย้อนกลับ
                </Button>
                <Button
                  onClick={handlePreviewSheet}
                  disabled={loading || !selectedSheet}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg"
                >
                  {loading ? 'กำลังโหลด Preview...' : 'ดู Preview ข้อมูล'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Table Configuration */}
        {step === 3 && (
          <div className="space-y-8">
            {/* Data Preview */}
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-white">
                    <Eye className="h-6 w-6 mr-3" />
                    Preview ข้อมูลจาก Sheet: {selectedSheet}
                  </CardTitle>
                  <Button
                    onClick={handlePreviewSheet}
                    disabled={loading}
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Refresh Preview
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto bg-gray-50 rounded-lg p-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex === 0 ? 'bg-blue-50 font-semibold' : ''}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border border-gray-200"
                            >
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.length > 5 && (
                    <p className="text-sm text-gray-500 mt-3 text-center font-medium">
                      ... และอีก {previewData.length - 5} แถว (รวม {previewData.length} แถว)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Table Configuration */}
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center text-white">
                  <Database className="h-6 w-6 mr-3" />
                  ตั้งค่าตาราง MySQL และ Data Types
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ชื่อตารางใน MySQL
                  </label>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="เช่น customers, sales_data"
                    className="text-lg p-4 border-2 border-gray-300 rounded-xl focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Column Mapping และ Data Types
                    </label>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        onClick={handlePreviewSheet}
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        disabled={loading}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Refresh Preview
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          console.log('Using mock data for testing');
                          const mockData = [
                            ['Name', 'Email', 'Age', 'City', 'Salary'],
                            ['John Doe', 'john@example.com', '30', 'Bangkok', '50000'],
                            ['Jane Smith', 'jane@example.com', '25', 'Chiang Mai', '45000']
                          ];
                          setPreviewData(mockData);
                          alert('ใช้ข้อมูลทดสอบแล้ว - ลอง AutoFill ได้เลย');
                        }}
                        size="sm"
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        📄 ใช้ข้อมูลทดสอบ
                      </Button>
                      <Button
                        type="button"
                        onClick={autoFillColumns}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 shadow-md"
                        disabled={!previewData || previewData.length === 0}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Auto Fill
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddColumnMapping}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 shadow-md"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        เพิ่ม Column
                      </Button>
                    </div>
                  </div>
                  {/* Column Selection Guide */}
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                      <span className="text-lg mr-2">💡</span>
                      วิธีเลือก Google Sheets Column:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <div className="text-blue-700 font-medium">🎯 ถ้า Sheet มีแถวหัวข้อ (Header Row):</div>
                        <div className="text-blue-600 pl-3 space-y-1">
                          <div>• กด "Refresh Preview" จะโหลด column names มาให้</div>
                          <div>• เลือกจาก dropdown (เช่น Name, Email, Age)</div>
                          <div>• ใช้ "Auto Fill" ได้เลย</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-blue-700 font-medium">📋 ถ้า Sheet ไม่มีแถวหัวข้อ:</div>
                        <div className="text-blue-600 pl-3 space-y-1">
                          <div>• เลือก Column A, B, C, D, E... จาก dropdown</div>
                          <div>• Column A = คอลัมน์แรก, Column B = คอลัมน์ที่ 2</div>
                          <div>• กำหนด MySQL column name เอง</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Debug Information */}
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="text-sm font-bold text-yellow-800 mb-3 flex items-center">
                      <span className="text-lg mr-2">🔍</span>
                      Debug Information:
                    </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="text-yellow-700"><strong>Preview Data:</strong> {previewData?.length || 0} rows</div>
                          <div className="text-yellow-700"><strong>Headers Found:</strong> {previewData?.[0] ? previewData[0].length : 0}</div>
                          <div className="text-yellow-700"><strong>Column Mappings:</strong> {columnMappings.length}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-yellow-700"><strong>Sheet URL:</strong> {sheetUrl ? 'Set' : 'Not set'}</div>
                          <div className="text-yellow-700"><strong>Selected Sheet:</strong> {selectedSheet || 'None'}</div>
                          <div className="text-yellow-700"><strong>Headers:</strong> {previewData?.[0] ? JSON.stringify(previewData[0].slice(0, 3)) + '...' : 'None'}</div>
                        </div>
                      </div>
                      {(!previewData || previewData.length === 0) && (
                        <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-xs">
                          <div className="text-red-800 font-bold mb-2">⚠️ No preview data available!</div>
                          <div className="text-red-700 space-y-1">
                            <div><strong>วิธีแก้ปัญหา:</strong></div>
                            <div>1. ลองกด "📄 ใช้ข้อมูลทดสอบ" เพื่อทดสอบ AutoFill</div>
                            <div>2. ตรวจสอบ Google Sheets URL ว่าถูกต้อง</div>
                            <div>3. ตรวจสอบว่า Sheet เป็น Public (แชร์ให้ทุกคนดูได้)</div>
                            <div>4. ตรวจสอบ Console ใน Browser Developer Tools</div>
                          </div>
                        </div>
                      )}
                      {previewData && previewData.length > 0 && (
                        <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded text-xs">
                          <div className="text-green-800 font-bold">✅ Preview data loaded successfully!</div>
                          <div className="text-green-700">ข้อมูลโหลดสำเร็จ - ตอนนี้สามารถเลือก columns และใช้ AutoFill ได้แล้ว</div>
                        </div>
                      )}
                    </div>
                  
                  {/* Data Type Guide */}
                  <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl shadow-sm">
                    <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center">
                      <span className="text-lg mr-2">💡</span>
                      คำแนะนำการเลือก Data Type:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="text-blue-700"><strong>VARCHAR(255)</strong> - ชื่อ, อีเมล, หมายเลขโทรศัพท์</div>
                        <div className="text-blue-700"><strong>TEXT</strong> - คำอธิบาย, ความคิดเห็น</div>
                        <div className="text-blue-700"><strong>INT</strong> - อายุ, จำนวน, ID</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-blue-700"><strong>DECIMAL(10,2)</strong> - ราคา, เงิน, คะแนน</div>
                        <div className="text-blue-700"><strong>DATETIME</strong> - วันที่เวลา, วันเกิด</div>
                        <div className="text-blue-700"><strong>BOOLEAN</strong> - สถานะ เปิด/ปิด, จริง/เท็จ</div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Data Display */}
                  {previewData && previewData.length > 0 && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center">
                        <Eye className="h-4 w-4 mr-2" />
                        ตัวอย่างข้อมูลจาก Google Sheets:
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border border-green-200 rounded-lg">
                          <thead className="bg-green-100">
                            <tr>
                              {previewData[0].map((header, index) => (
                                <th key={index} className="px-3 py-2 text-left font-medium text-green-900 border-b border-green-200">
                                  {header || `Column ${index + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.slice(1, 4).map((row, rowIndex) => (
                              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-3 py-2 border-b border-green-100">
                                    {cell || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-green-600 mt-2">
                        💡 หากคุณไม่เห็น columns ใน dropdown ด้านล่าง ให้ลองกดปุ่ม "ดู Preview" อีกครั้ง
                      </p>
                    </div>
                  )}

                  {/* Debug Info */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-3 bg-gray-100 border rounded-lg text-xs">
                      <strong>Debug Info:</strong><br/>
                      Preview Data Length: {previewData ? previewData.length : 'undefined'}<br/>
                      Headers: {previewData && previewData[0] ? JSON.stringify(previewData[0]) : 'none'}<br/>
                      Column Mappings: {columnMappings.length}
                    </div>
                  )}
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-xl p-6 bg-gray-50">
                    {columnMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center space-x-4 p-6 border border-gray-300 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg">
                          {index + 1}
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 mb-2">
                            Google Sheets Column
                          </label>
                          <select
                            value={mapping.googleColumn}
                            onChange={(e) => {
                              console.log('Column selected:', e.target.value);
                              handleColumnMappingChange(index, 'googleColumn', e.target.value);
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-blue-500 transition-colors"
                          >
                            <option value="">เลือก Column</option>
                            {previewData && previewData.length > 0 && previewData[0] ? (
                              previewData[0].map((header, headerIndex) => (
                                <option key={`header-${headerIndex}`} value={header}>
                                  {header || `Column ${headerIndex + 1}`}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="A">Column A</option>
                                <option value="B">Column B</option>
                                <option value="C">Column C</option>
                                <option value="D">Column D</option>
                                <option value="E">Column E</option>
                                <option value="F">Column F</option>
                                <option value="G">Column G</option>
                                <option value="H">Column H</option>
                                <option value="I">Column I</option>
                                <option value="J">Column J</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 mb-2">
                            MySQL Column Name
                          </label>
                          <Input
                            value={mapping.mysqlColumn}
                            onChange={(e) => handleColumnMappingChange(index, 'mysqlColumn', e.target.value)}
                            placeholder="column_name"
                            className="text-sm p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 transition-colors"
                          />
                        </div>

                        <div className="w-52">
                          <label className="block text-xs font-medium text-gray-500 mb-2">
                            Data Type
                          </label>
                          <select
                            value={mapping.dataType}
                            onChange={(e) => handleColumnMappingChange(index, 'dataType', e.target.value as any)}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-blue-500 transition-colors"
                          >
                            <optgroup label="📝 String Types">
                              <option value="VARCHAR(255)">VARCHAR(255) - ข้อความสั้น</option>
                              <option value="VARCHAR(500)">VARCHAR(500) - ข้อความกลาง</option>
                              <option value="VARCHAR(1000)">VARCHAR(1000) - ข้อความยาว</option>
                              <option value="TEXT">TEXT - ข้อความยาวมาก</option>
                              <option value="LONGTEXT">LONGTEXT - ข้อความยาวที่สุด</option>
                              <option value="CHAR(10)">CHAR(10) - ข้อความความยาวคงที่</option>
                            </optgroup>
                            <optgroup label="🔢 Number Types">
                              <option value="TINYINT">TINYINT - เลขเต็มเล็ก (-128 ถึง 127)</option>
                              <option value="SMALLINT">SMALLINT - เลขเต็มเล็ก (-32K ถึง 32K)</option>
                              <option value="INT">INT - เลขเต็มปกติ</option>
                              <option value="BIGINT">BIGINT - เลขเต็มใหญ่</option>
                              <option value="DECIMAL(10,2)">DECIMAL(10,2) - ทศนิยม 2 ตำแหน่ง</option>
                              <option value="DECIMAL(15,4)">DECIMAL(15,4) - ทศนิยม 4 ตำแหน่ง</option>
                              <option value="FLOAT">FLOAT - จำนวนจริงแบบลอย</option>
                              <option value="DOUBLE">DOUBLE - จำนวนจริงความแม่นยำสูง</option>
                            </optgroup>
                            <optgroup label="📅 Date/Time Types">
                              <option value="DATETIME">DATETIME - วันที่และเวลา</option>
                              <option value="DATE">DATE - วันที่เท่านั้น</option>
                              <option value="TIME">TIME - เวลาเท่านั้น</option>
                              <option value="TIMESTAMP">TIMESTAMP - เวลาแบบ Unix</option>
                            </optgroup>
                            <optgroup label="🔧 Other Types">
                              <option value="BOOLEAN">BOOLEAN - จริง/เท็จ</option>
                              <option value="JSON">JSON - ข้อมูล JSON</option>
                            </optgroup>
                          </select>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveColumnMapping(index)}
                          disabled={columnMappings.length === 1}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 border-2"
                  >
                    ย้อนกลับ
                  </Button>
                  <Button
                    onClick={handleCreateTable}
                    disabled={loading || !tableName || columnMappings.some(m => !m.googleColumn || !m.mysqlColumn)}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 shadow-xl text-lg font-semibold"
                  >
                    {loading ? 'กำลังสร้างการตั้งค่า...' : '✨ สร้างการตั้งค่าใหม่'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
