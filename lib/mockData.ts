// Mock data for development when database is not available
export const mockConfigs = [
  {
    id: 1,
    name: "ข้อมูลลูกค้า",
    sheet_url: "https://docs.google.com/spreadsheets/d/1abc123",
    sheet_name: "Customers",
    table_name: "customers",
    columns: { name: "TEXT", email: "TEXT", phone: "TEXT" },
    is_active: true,
    last_sync_at: new Date().toISOString(),
    row_count: 150,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    name: "รายการสินค้า",
    sheet_url: "https://docs.google.com/spreadsheets/d/1def456",
    sheet_name: "Products",
    table_name: "products",
    columns: { name: "TEXT", price: "DECIMAL", category: "TEXT" },
    is_active: true,
    last_sync_at: new Date().toISOString(),
    row_count: 85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    name: "คำสั่งซื้อ",
    sheet_url: "https://docs.google.com/spreadsheets/d/1ghi789",
    sheet_name: "Orders",
    table_name: "orders",
    columns: { order_id: "TEXT", customer: "TEXT", amount: "DECIMAL" },
    is_active: true,
    last_sync_at: new Date().toISOString(),
    row_count: 320,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockStats = {
  totalConfigs: 3,
  activeConfigs: 3,
  totalRows: 555,
  lastSyncAgo: "2 นาทีที่แล้ว"
};

export const mockRecentLogs = [
  {
    id: 1,
    config_id: 1,
    status: 'success',
    message: 'Smart Delta Sync completed - 3 changes detected',
    rows_synced: 3,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  },
  {
    id: 2,
    config_id: 2,
    status: 'success',
    message: 'Smart Delta Sync completed - no changes detected',
    rows_synced: 0,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: 3,
    config_id: 3,
    status: 'success',
    message: 'Smart Delta Sync completed - 1 new row added',
    rows_synced: 1,
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  }
];

export const mockRealtimeStatus = {
  totalJobs: 3,
  activeJobs: 3,
  jobs: [
    { configId: 1, isRunning: true, interval: 120, lastRun: new Date().toISOString() },
    { configId: 2, isRunning: true, interval: 120, lastRun: new Date().toISOString() },
    { configId: 3, isRunning: true, interval: 120, lastRun: new Date().toISOString() }
  ]
};

export const mockSmartAutoPilot = {
  smartSyncEnabled: true,
  status: "🚀 Smart Auto-Pilot Active",
  description: "ระบบ Smart Auto-Pilot กำลังทำงานอย่างมีประสิทธิภาพ ใช้ Smart Delta Sync เพื่อประหยัด 70-80% ของการใช้งาน",
  activeSyncJobs: 3,
  pollingJobs: 3,
  lastActivity: new Date().toISOString()
};

export const mockGoogleStatus = {
  status: 'connected',
  message: 'Google Sheets API เชื่อมต่อสำเร็จ'
};
