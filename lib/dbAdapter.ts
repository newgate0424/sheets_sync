// Database Adapter - รองรับทั้ง MySQL และ PostgreSQL
import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';

export type DatabaseType = 'mysql' | 'postgresql';

interface QueryResult {
  rows: any[];
  rowCount?: number;
}

// ฟังก์ชันดึง connection string จาก MongoDB
async function getConnectionStringFromMongo(): Promise<string | null> {
  // Skip MongoDB connection during build time if DATABASE_USER_URL is not set
  if (!process.env.DATABASE_USER_URL) {
    console.warn('DATABASE_USER_URL not set, skipping MongoDB connection');
    return null;
  }
  
  try {
    const { getMongoDb } = await import('./mongoDb');
    const db = await getMongoDb();
    const settings = await db.collection('settings').findOne({ key: 'database_connection' });
    return settings?.value || null;
  } catch (error) {
    console.error('Error getting connection string from MongoDB:', error);
    return null;
  }
}

class DatabaseAdapter {
  private type!: DatabaseType;
  private pgPool?: PgPool;
  private mysqlPool?: mysql.Pool;
  private customConnectionString?: string;
  private connectionString?: string;
  private initialized: boolean = false;

  constructor(customConnectionString?: string) {
    this.customConnectionString = customConnectionString;
  }

  async initialize() {
    if (this.initialized) return;
    
    // ดึง connection string จาก MongoDB ถ้าไม่มี custom connection string
    if (!this.customConnectionString) {
      this.connectionString = await getConnectionStringFromMongo() || process.env.DATABASE_URL;
    } else {
      this.connectionString = this.customConnectionString;
    }
    
    this.type = this.detectDatabaseType();
    this.initializeConnection();
    this.initialized = true;
  }

  private detectDatabaseType(): DatabaseType {
    const dbUrl = this.connectionString || '';
    
    if (!dbUrl) {
      console.warn('DATABASE_URL not set, defaulting to postgresql');
      return 'postgresql';
    }
    
    if (dbUrl.startsWith('mysql://')) {
      return 'mysql';
    }
    
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      return 'postgresql';
    }
    
    // Default to postgresql if unable to determine
    console.warn('Unable to determine database type from URL, defaulting to postgresql');
    return 'postgresql';
  }

  private initializeConnection() {
    const connectionString = this.connectionString;

    if (this.type === 'postgresql') {
      this.pgPool = new PgPool({
        connectionString,
        ssl: connectionString?.includes('127.0.0.1') || connectionString?.includes('localhost')
          ? false
          : { rejectUnauthorized: false }
      });
    } else {
      // Parse MySQL connection string
      try {
        const url = new URL(connectionString || '');
        
        // Try without SSL first for remote connections, as some servers don't support SSL
        this.mysqlPool = mysql.createPool({
          host: url.hostname,
          port: parseInt(url.port) || 3306,
          user: url.username,
          password: decodeURIComponent(url.password),
          database: url.pathname.slice(1),
          waitForConnections: true,
          connectionLimit: 10
          // SSL disabled by default
        });
      } catch (error) {
        console.error('Failed to parse MySQL connection string:', error);
        throw new Error('Invalid MySQL connection string');
      }
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (this.type === 'postgresql') {
      return this.queryPostgreSQL(sql, params);
    } else {
      return this.queryMySQL(sql, params);
    }
  }

  private async queryPostgreSQL(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pgPool) throw new Error('PostgreSQL pool not initialized');
    
    const result = await this.pgPool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0
    };
  }

  private async queryMySQL(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.mysqlPool) throw new Error('MySQL pool not initialized');

    // แปลง $1, $2 เป็น ? สำหรับ MySQL
    let mysqlSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 0;
      mysqlSql = sql.replace(/\$\d+/g, () => {
        paramIndex++;
        return '?';
      });
    }

    // แปลง double quotes เป็น backticks สำหรับ table/column names
    mysqlSql = mysqlSql.replace(/"([^"]+)"/g, '`$1`');

    const [rows] = await this.mysqlPool.execute(mysqlSql, params);
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0
    };
  }

  getDatabaseType(): DatabaseType {
    return this.type;
  }

  // สร้าง SQL ตาม database type
  createTableSQL(tableName: string, columns: any[]): string {
    const columnDefs = columns.map((col: any) => {
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      return `"${col.name}" ${col.type} ${nullable}`;
    }).join(', ');

    if (this.type === 'postgresql') {
      return `CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
    } else {
      const mysqlColumnDefs = columns.map((col: any) => {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        return `\`${col.name}\` ${col.type} ${nullable}`;
      }).join(', ');
      
      return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ${mysqlColumnDefs},
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
    }
  }

  // สร้าง INSERT SQL ตาม database type
  createInsertSQL(tableName: string, columns: string[], batchSize: number): { sql: string; paramCount: number } {
    const columnCount = columns.length;
    
    if (this.type === 'postgresql') {
      const quotedColumns = columns.map(c => `"${c}"`).join(', ');
      const placeholders: string[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const rowPlaceholders = [];
        for (let j = 0; j < columnCount; j++) {
          rowPlaceholders.push(`$${i * columnCount + j + 1}`);
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
      }
      
      return {
        sql: `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${placeholders.join(', ')}`,
        paramCount: batchSize * columnCount
      };
    } else {
      const quotedColumns = columns.map(c => `\`${c}\``).join(', ');
      const placeholders = Array(batchSize).fill('(' + Array(columnCount).fill('?').join(', ') + ')').join(', ');
      
      return {
        sql: `INSERT INTO \`${tableName}\` (${quotedColumns}) VALUES ${placeholders}`,
        paramCount: batchSize * columnCount
      };
    }
  }

  // Quote identifier ตาม database type
  quoteIdentifier(name: string): string {
    return this.type === 'postgresql' ? `"${name}"` : `\`${name}\``;
  }

  // สร้าง UPSERT SQL
  createUpsertSQL(tableName: string, columns: string[], conflictColumns: string[]): string {
    if (this.type === 'postgresql') {
      const quotedColumns = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const conflict = conflictColumns.map(c => `"${c}"`).join(', ');
      const updates = columns
        .filter(c => !conflictColumns.includes(c))
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
      
      return `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})
              ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`;
    } else {
      const quotedColumns = columns.map(c => `\`${c}\``).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const updates = columns
        .filter(c => !conflictColumns.includes(c))
        .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
        .join(', ');
      
      return `INSERT INTO \`${tableName}\` (${quotedColumns}) VALUES (${placeholders})
              ON DUPLICATE KEY UPDATE ${updates}`;
    }
  }

  async close() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    if (this.mysqlPool) {
      await this.mysqlPool.end();
    }
  }

  async end() {
    await this.close();
  }

  // Method to reinitialize connection (for hot reload)
  async reinitialize() {
    this.initialized = false;
    await this.close();
    await this.initialize();
  }
}

// Export singleton instance and class
export default DatabaseAdapter;

// Lazy initialization of singleton
let dbInstance: DatabaseAdapter | null = null;
let initPromise: Promise<void> | null = null;

export const getDb = (): DatabaseAdapter => {
  if (!dbInstance) {
    dbInstance = new DatabaseAdapter();
    initPromise = dbInstance.initialize();
  }
  return dbInstance;
};

// ฟังก์ชันรอให้ initialization เสร็จ
export const ensureDbInitialized = async (): Promise<DatabaseAdapter> => {
  const db = getDb();
  if (initPromise) {
    await initPromise;
  }
  return db;
};

export const db = getDb();
export const pool = db; // Backward compatibility

// Function to reset the database connection
export const resetDbConnection = async () => {
  if (dbInstance) {
    await dbInstance.reinitialize();
  }
  dbInstance = null;
  initPromise = null;
};
