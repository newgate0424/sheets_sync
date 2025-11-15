import crypto from 'crypto'
import { prisma } from './db'
import { googleSheetsService } from './google-sheets'
import mysql from 'mysql2/promise'
import { Prisma } from '@prisma/client'

interface ColumnSchema {
  name: string
  type: string // MySQL data type
}

interface SyncConfig {
  id: string
  spreadsheetId: string
  sheetName: string
  range: string
  tableName: string
  schema: ColumnSchema[]
}

export class SyncService {
  private connection: mysql.Connection | null = null
  private activeSyncs: Map<string, number> = new Map()
  private syncTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private readonly SYNC_TIMEOUT = 10 * 60 * 1000 // 10 minutes

  /**
   * Clear stuck sync locks
   */
  clearSyncLock(configId: string) {
    this.activeSyncs.delete(configId)
    if (this.syncTimeouts.has(configId)) {
      clearTimeout(this.syncTimeouts.get(configId)!)
      this.syncTimeouts.delete(configId)
    }
    console.log(`🔓 Cleared sync lock for config ${configId}`)
  }

  /**
   * Check if sync is actually running (not just locked)
   */
  isSyncRunning(configId: string) {
    return this.activeSyncs.has(configId)
  }

  /**
   * สร้าง MySQL connection
   */
  private async getConnection() {
    if (!this.connection) {
      const dbUrl = process.env.DATABASE_URL!
      const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
      
      if (!match) {
        throw new Error('Invalid DATABASE_URL format')
      }

      const [, user, password, host, port, database] = match

      this.connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password,
        database,
        // Optimize for bulk operations
        connectTimeout: 60000,
        multipleStatements: true,
      })
      
      // Set MySQL session variables for better performance
      try {
        await this.connection.execute('SET SESSION sql_mode = ""')
      } catch (e) {
        // Ignore if sql_mode cannot be changed
      }
    }
    return this.connection
  }

  /**
   * สร้างตารางใน MySQL ตาม Schema ที่กำหนด
   */
  async createTable(tableName: string, schema: ColumnSchema[]) {
    const conn = await this.getConnection()
    
    // เพิ่มคอลัมน์พื้นฐาน
    const columns = [
      '`id` VARCHAR(191) PRIMARY KEY',
      '`row_index` INT NOT NULL UNIQUE',
      '`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP',
      '`updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ...schema.map(col => `\`${this.sanitizeColumnName(col.name)}\` ${col.type}`),
    ]

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        ${columns.join(',\n        ')},
        INDEX idx_row_index (row_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `

    try {
      await conn.execute(createTableSQL)
      return { success: true }
    } catch (error: any) {
      console.error('Error creating table:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * ทำความสะอาดชื่อคอลัมน์ให้เป็นไปตามกฎของ MySQL
   */
  private sanitizeColumnName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1')
      .substring(0, 64)
  }

  /**
   * สร้าง Checksum (MD5) จากข้อมูลแถว
   */
  private createChecksum(rowData: any[]): string {
    const data = JSON.stringify(rowData)
    return crypto.createHash('md5').update(data).digest('hex')
  }

  /**
   * ซิงค์ข้อมูลจาก Google Sheets ไป MySQL
   * ใช้วิธี Smart Sync - เปรียบเทียบ Checksum เพื่ออัปเดตเฉพาะข้อมูลที่เปลี่ยน
   */
  async syncData(configId: string, forceSync: boolean = false) {
    // Check if sync is already running
    if (this.activeSyncs.has(configId)) {
      if (forceSync) {
        console.log(`⚠️  Force syncing config ${configId}, clearing existing lock`)
        this.clearSyncLock(configId)
      } else {
        const lockTime = this.activeSyncs.get(configId)!
        const elapsed = Date.now() - lockTime
        if (elapsed > this.SYNC_TIMEOUT) {
          console.log(`⚠️  Sync lock expired (${Math.floor(elapsed/1000)}s), clearing lock`)
          this.clearSyncLock(configId)
        } else {
          throw new Error(`Sync already in progress for this configuration (${Math.floor(elapsed/1000)}s)`)
        }
      }
    }

    // Set lock with timestamp
    this.activeSyncs.set(configId, Date.now())
    
    // Auto-clear lock after timeout
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Sync timeout reached for config ${configId}, auto-clearing lock`)
      this.clearSyncLock(configId)
    }, this.SYNC_TIMEOUT)
    this.syncTimeouts.set(configId, timeoutId)
    
    const startTime = Date.now()
    let syncLog: any = null
    
    try {
      // สร้าง Sync Log
      syncLog = await prisma.syncLog.create({
        data: {
          configId,
          status: 'running',
        },
      })

      // ดึง Config
      const config = await prisma.sheetConfig.findUnique({
        where: { id: configId },
      })

      if (!config) {
        throw new Error('Config not found')
      }

      const schema = Array.isArray(config.schema) 
        ? (config.schema as unknown as ColumnSchema[])
        : []
      
      if (schema.length === 0) {
        throw new Error('Invalid schema configuration')
      }

      const conn = await this.getConnection()

      // ตรวจสอบว่าตารางมีอยู่หรือยัง ถ้าไม่มีให้สร้าง
      await this.createTable(config.tableName, schema)

      // นับจำนวนแถวทั้งหมดใน Google Sheets
      console.log(`📊 Counting total rows for config ${configId}...`)
      const totalRows = await googleSheetsService.getSheetRowCount(
        config.spreadsheetId,
        config.sheetName
      )
      console.log(`📊 Total rows: ${totalRows}`)

      let rowsProcessed = 0
      let rowsInserted = 0
      let rowsUpdated = 0
      let rowsDeleted = 0

      // ดึง checksum ที่มีอยู่แล้วในฐานข้อมูล
      console.log(`🔍 Loading existing checksums for table ${config.tableName}...`)
      const existingChecksums = await prisma.rowChecksum.findMany({
        where: { tableName: config.tableName },
      })
      console.log(`🔍 Found ${existingChecksums.length} existing checksums`)

      const checksumMap = new Map(
        existingChecksums.map(cs => [cs.rowIndex, cs.checksum])
      )

      const currentRowIndices = new Set<number>()

      // ดึงข้อมูลทีละ Batch (100,000 แถว สำหรับข้อมูลขนาดใหญ่)
      const batchSize = totalRows > 100000 ? 100000 : 50000
      let startRow = 2 // เริ่มจากแถวที่ 2 (ข้าม header)
      const totalBatches = Math.ceil((totalRows - 1) / batchSize)
      let currentBatch = 0

      console.log(`🔄 Starting sync: ${totalRows} rows in ${totalBatches} batches (batch size: ${batchSize})`)

      // Disable keys สำหรับการ INSERT ที่เร็วขึ้น (ถ้าเป็น MyISAM)
      try {
        await conn.execute(`ALTER TABLE \`${config.tableName}\` DISABLE KEYS`)
      } catch (e) {
        // InnoDB ไม่รองรับ DISABLE KEYS, ไม่เป็นไร
      }

      while (startRow <= totalRows) {
        currentBatch++
        console.log(`📦 Processing batch ${currentBatch}/${totalBatches} (rows ${startRow} to ${Math.min(startRow + batchSize - 1, totalRows)})`)
        const result = await googleSheetsService.getSheetData(
          {
            spreadsheetId: config.spreadsheetId,
            sheetName: config.sheetName,
          },
          startRow,
          batchSize
        )

        if (!result.success || result.data.length === 0) {
          break
        }

        // เก็บข้อมูลที่ต้อง insert/update ไว้ก่อน
        const rowsToInsert: any[] = []
        const rowsToUpdate: any[] = []
        const checksumUpdates: any[] = []
        const columnNames = schema.map(col => this.sanitizeColumnName(col.name))

        // ประมวลผลแต่ละแถว
        for (let i = 0; i < result.data.length; i++) {
          const rowData = result.data[i]
          const rowIndex = startRow + i
          currentRowIndices.add(rowIndex)

          const checksum = this.createChecksum(rowData)
          const existingChecksum = checksumMap.get(rowIndex)

          // ถ้า checksum เหมือนเดิม = ข้อมูลไม่เปลี่ยน ข้ามไป
          if (existingChecksum === checksum) {
            rowsProcessed++
            continue
          }

          // แปลงข้อมูลตาม Schema
          const values = columnNames.map((colName, idx) => {
            const val = rowData[idx]
            if (val === null || val === undefined || val === '') return null
            return String(val)
          })

          const rowId = crypto.randomUUID()

          if (existingChecksum) {
            // มีข้อมูลอยู่แล้ว = UPDATE
            rowsToUpdate.push({ rowIndex, values })
            rowsUpdated++
          } else {
            // ไม่มีข้อมูล = INSERT
            rowsToInsert.push({ rowId, rowIndex, values })
            rowsInserted++
          }

          // เก็บ checksum ไว้อัปเดตภายหลัง
          checksumUpdates.push({
            tableName: config.tableName,
            rowIndex,
            checksum,
          })

          rowsProcessed++
        }

        // Bulk INSERT - แบ่งเป็น chunks เพื่อหลีกเลี่ยง placeholder limit
        if (rowsToInsert.length > 0) {
          console.log(`  ➕ Inserting ${rowsToInsert.length} new rows...`)
          const columnsPerRow = columnNames.length + 2 // +2 for id, row_index
          const maxPlaceholders = 65000 // MySQL limit is 65535
          const safeChunkSize = Math.floor(maxPlaceholders / columnsPerRow)
          // เพิ่ม chunk size สำหรับข้อมูลขนาดใหญ่
          const insertChunkSize = Math.min(5000, safeChunkSize)

          for (let chunkStart = 0; chunkStart < rowsToInsert.length; chunkStart += insertChunkSize) {
            const chunk = rowsToInsert.slice(chunkStart, Math.min(chunkStart + insertChunkSize, rowsToInsert.length))
            
            const placeholders = columnNames.map(() => '?').join(', ')
            const valuesSets = chunk.map(() => `(?, ?, ${placeholders})`).join(', ')
            const allValues = chunk.flatMap(row => [row.rowId, row.rowIndex, ...row.values])

            // ใช้ INSERT IGNORE เพื่อข้าม row ที่มี row_index ซ้ำ
            await conn.execute(
              `INSERT IGNORE INTO \`${config.tableName}\` 
               (id, row_index, ${columnNames.map(n => `\`${n}\``).join(', ')}) 
               VALUES ${valuesSets}`,
              allValues
            )

            // Bulk insert checksums พร้อมกับ data
            const checksumChunk = chunk.filter(row => {
              const idx = checksumUpdates.findIndex(
                u => u.rowIndex === row.rowIndex
              )
              return idx !== -1
            })

            if (checksumChunk.length > 0) {
              const checksumPlaceholders = checksumChunk.map(() => '(?, ?, ?, ?)').join(', ')
              const checksumValues = checksumChunk.flatMap(row => {
                const update = checksumUpdates.find(u => u.rowIndex === row.rowIndex)
                return [
                  crypto.randomUUID(),
                  config.tableName,
                  row.rowIndex,
                  update!.checksum
                ]
              })

              // ใช้ INSERT IGNORE สำหรับ checksum ด้วย
              await conn.execute(
                `INSERT IGNORE INTO RowChecksum (id, tableName, rowIndex, checksum) 
                 VALUES ${checksumPlaceholders}`,
                checksumValues
              )
            }
          }
        }

        // Bulk UPDATE - แบ่งเป็น chunks
        if (rowsToUpdate.length > 0) {
          console.log(`  ✏️  Updating ${rowsToUpdate.length} changed rows...`)
          const columnsPerRow = columnNames.length + 1 // +1 for row_index
          const maxPlaceholders = 65000
          const safeChunkSize = Math.floor(maxPlaceholders / columnsPerRow)
          // เพิ่ม chunk size สำหรับ UPDATE
          const updateChunkSize = Math.min(5000, safeChunkSize)

          for (let chunkStart = 0; chunkStart < rowsToUpdate.length; chunkStart += updateChunkSize) {
            const chunk = rowsToUpdate.slice(chunkStart, Math.min(chunkStart + updateChunkSize, rowsToUpdate.length))
            
            for (const row of chunk) {
              const setClauses = columnNames.map(col => `\`${col}\` = ?`).join(', ')
              const updateValues = [...row.values, row.rowIndex]

              await conn.execute(
                `UPDATE \`${config.tableName}\` SET ${setClauses}, updated_at = NOW() WHERE row_index = ?`,
                updateValues
              )

              // Update checksum
              const update = checksumUpdates.find(u => u.rowIndex === row.rowIndex)
              if (update) {
                await conn.execute(
                  `UPDATE RowChecksum SET checksum = ?, lastSyncedAt = NOW() 
                   WHERE tableName = ? AND rowIndex = ?`,
                  [update.checksum, config.tableName, row.rowIndex]
                )
              }
            }
          }
        }

        // Clear processed checksums
        checksumUpdates.length = 0

        // อัปเดต progress
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { rowsProcessed },
        })

        startRow += batchSize
      }

      // ลบแถวที่ไม่มีใน Google Sheets แล้ว (Bulk Delete)
      console.log(`🗑️  Checking for deleted rows...`)
      const rowsToDelete = Array.from(checksumMap.keys())
        .map(Number)
        .filter(rowIndex => !currentRowIndices.has(rowIndex))

      if (rowsToDelete.length > 0) {
        console.log(`  🗑️  Deleting ${rowsToDelete.length} removed rows...`)
        // แบ่ง delete เป็น chunks เพื่อหลีกเลี่ยง placeholder limit
        const deleteChunkSize = 5000
        
        for (let i = 0; i < rowsToDelete.length; i += deleteChunkSize) {
          const chunk = rowsToDelete.slice(i, Math.min(i + deleteChunkSize, rowsToDelete.length))
          const placeholders = chunk.map(() => '?').join(', ')
          
          // Bulk delete from main table
          await conn.execute(
            `DELETE FROM \`${config.tableName}\` WHERE row_index IN (${placeholders})`,
            chunk
          )

          // Bulk delete checksums
          await prisma.rowChecksum.deleteMany({
            where: {
              tableName: config.tableName,
              rowIndex: { in: chunk },
            },
          })
        }

        rowsDeleted = rowsToDelete.length
      }

      // Enable keys กลับ
      try {
        await conn.execute(`ALTER TABLE \`${config.tableName}\` ENABLE KEYS`)
      } catch (e) {
        // InnoDB ไม่รองรับ ENABLE KEYS
      }

      // อัปเดต Sync Log เป็น success
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'success',
          completedAt: new Date(),
          rowsProcessed,
          rowsInserted,
          rowsUpdated,
          rowsDeleted,
        },
      })

      const duration = Date.now() - startTime

      console.log(`✅ Sync completed in ${(duration/1000).toFixed(2)}s: ${rowsProcessed} processed, ${rowsInserted} inserted, ${rowsUpdated} updated, ${rowsDeleted} deleted`)

      return {
        success: true,
        syncLogId: syncLog.id,
        duration,
        rowsProcessed,
        rowsInserted,
        rowsUpdated,
        rowsDeleted,
      }
    } catch (error: any) {
      console.error('Sync error:', error)

      // อัปเดต Sync Log เป็น failed
      if (syncLog) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error.message,
          },
        })
      }

      return {
        success: false,
        error: error.message,
      }
    } finally {
      this.clearSyncLock(configId)
    }
  }

  /**
   * ดึงข้อมูลจากตาราง (สำหรับแสดงผล)
   */
  async getTableData(
    tableName: string, 
    page: number = 1, 
    limit: number = 100,
    search: string = '',
    searchColumn: string = 'all'
  ) {
    const conn = await this.getConnection()
    const offset = (page - 1) * limit

    try {
      let whereClause = ''
      let params: any[] = []

      // สร้าง WHERE clause สำหรับค้นหา
      if (search) {
        if (searchColumn === 'all') {
          // ดึงคอลัมน์ทั้งหมดจากตาราง
          const [columns] = await conn.execute(
            `SHOW COLUMNS FROM \`${tableName}\``
          ) as any
          
          const columnNames = columns
            .map((col: any) => col.Field)
            .filter((name: string) => !['id', 'row_index', 'created_at', 'updated_at'].includes(name))
          
          if (columnNames.length > 0) {
            const conditions = columnNames
              .map((col: string) => `\`${col}\` LIKE ?`)
              .join(' OR ')
            whereClause = `WHERE (${conditions})`
            params = columnNames.map(() => `%${search}%`)
          }
        } else {
          // ค้นหาเฉพาะคอลัมน์ที่เลือก
          whereClause = `WHERE \`${searchColumn}\` LIKE ?`
          params = [`%${search}%`]
        }
      }

      const [rows] = await conn.execute(
        `SELECT * FROM \`${tableName}\` ${whereClause} ORDER BY row_index LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )

      const [countResult] = await conn.execute(
        `SELECT COUNT(*) as total FROM \`${tableName}\` ${whereClause}`,
        params
      )

      const total = Array.isArray(countResult) && countResult.length > 0 
        ? (countResult[0] as any).total 
        : 0

      return {
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      }
    }
  }

  /**
   * ปิด connection
   */
  async close() {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }
}

export const syncService = new SyncService()
