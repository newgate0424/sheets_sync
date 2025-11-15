export interface SheetConfig {
  id: string
  name: string
  spreadsheetId: string
  sheetName: string
  range: string
  tableName: string
  schema: ColumnSchema[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ColumnSchema {
  name: string
  type: string
}

export interface SyncLog {
  id: string
  configId: string
  status: 'running' | 'success' | 'failed'
  startedAt: Date
  completedAt?: Date
  rowsProcessed: number
  rowsInserted: number
  rowsUpdated: number
  rowsDeleted: number
  errorMessage?: string
}

export interface TableStats {
  tableName: string
  rowCount: number
  lastSyncedAt?: Date
  configName: string
}
