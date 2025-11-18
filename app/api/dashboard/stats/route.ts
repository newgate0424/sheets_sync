import { NextResponse } from 'next/server';
import { ensureDbInitialized } from '@/lib/dbAdapter';

export async function GET() {
  try {
    const pool = await ensureDbInitialized();
    const dbType = pool.getDatabaseType();

    // นับจำนวนตาราง
    let totalTables = 0;
    try {
      let tablesQuery: string;
      if (dbType === 'mysql') {
        tablesQuery = `SELECT COUNT(*) as total FROM \`sync_config\``;
      } else {
        tablesQuery = `SELECT COUNT(*) as total FROM "sync_config"`;
      }
      const tablesResult = await pool.query(tablesQuery);
      totalTables = parseInt(tablesResult.rows[0]?.total || 0);
    } catch (error) {
      console.error('Error counting tables:', error);
    }

    // นับจำนวน cron jobs ที่ active
    let activeCronJobs = 0;
    try {
      // ตรวจสอบว่ามี column cron_schedule หรือไม่
      let checkColumnQuery: string;
      if (dbType === 'mysql') {
        checkColumnQuery = `SHOW COLUMNS FROM \`sync_config\` LIKE 'cron_schedule'`;
      } else {
        checkColumnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name = 'sync_config' AND column_name = 'cron_schedule'`;
      }
      
      const columnCheck = await pool.query(checkColumnQuery);
      
      // ถ้ามี column cron_schedule ให้นับ
      if (columnCheck.rows && columnCheck.rows.length > 0) {
        let cronQuery: string;
        if (dbType === 'mysql') {
          cronQuery = `SELECT COUNT(*) as total FROM \`sync_config\` WHERE \`cron_schedule\` IS NOT NULL AND \`cron_schedule\` != ''`;
        } else {
          cronQuery = `SELECT COUNT(*) as total FROM "sync_config" WHERE "cron_schedule" IS NOT NULL AND "cron_schedule" != ''`;
        }
        const cronResult = await pool.query(cronQuery);
        activeCronJobs = parseInt(cronResult.rows[0]?.total || 0);
      }
    } catch (error) {
      console.error('Error counting cron jobs:', error);
    }

    // นับจำนวน folders จาก MongoDB
    let totalFolders = 0;
    try {
      const { getMongoDb } = await import('@/lib/mongoDb');
      const db = await getMongoDb();
      totalFolders = await db.collection('folders').countDocuments();
    } catch (error) {
      console.error('Error counting folders:', error);
    }

    // คำนวณจำนวนแถวรวม
    let totalRows = 0;
    try {
      const tables = await pool.query(
        dbType === 'mysql' 
          ? `SELECT \`table_name\` FROM \`sync_config\``
          : `SELECT "table_name" FROM "sync_config"`
      );
      
      for (const table of tables.rows) {
        try {
          const countQuery = dbType === 'mysql'
            ? `SELECT COUNT(*) as cnt FROM \`${table.table_name}\``
            : `SELECT COUNT(*) as cnt FROM "${table.table_name}"`;
          const result = await pool.query(countQuery);
          totalRows += parseInt(result.rows[0]?.cnt || 0);
        } catch (error) {
          // ตารางอาจถูกลบไปแล้ว ข้าม
          continue;
        }
      }
    } catch (error) {
      console.error('Error counting total rows:', error);
    }

    // คำนวณอัตราสำเร็จ (จากข้อมูล sync_logs)
    let successRate = 100;
    try {
      const { getMongoDb } = await import('@/lib/mongoDb');
      const db = await getMongoDb();
      
      const totalSyncs = await db.collection('sync_logs').countDocuments();
      const successfulSyncs = await db.collection('sync_logs').countDocuments({ status: 'success' });
      
      if (totalSyncs > 0) {
        successRate = Math.round((successfulSyncs / totalSyncs) * 100);
      }
    } catch (error) {
      console.error('Error calculating success rate:', error);
    }

    // สถิติการซิงค์
    let syncsToday = 0;
    let syncsThisWeek = 0;
    let syncsThisMonth = 0;
    
    try {
      const { getMongoDb } = await import('@/lib/mongoDb');
      const db = await getMongoDb();
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      syncsToday = await db.collection('sync_logs').countDocuments({
        created_at: { $gte: startOfDay }
      });
      
      syncsThisWeek = await db.collection('sync_logs').countDocuments({
        created_at: { $gte: startOfWeek }
      });
      
      syncsThisMonth = await db.collection('sync_logs').countDocuments({
        created_at: { $gte: startOfMonth }
      });
    } catch (error) {
      console.error('Error fetching sync stats:', error);
    }

    return NextResponse.json({
      totalTables,
      totalRows,
      activeCronJobs,
      successRate,
      totalFolders,
      dbType,
      syncsToday,
      syncsThisWeek,
      syncsThisMonth
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ 
      error: error.message,
      totalTables: 0,
      totalRows: 0,
      activeCronJobs: 0,
      successRate: 100,
      totalFolders: 0,
      dbType: 'postgresql',
      syncsToday: 0,
      syncsThisWeek: 0,
      syncsThisMonth: 0
    }, { status: 200 }); // Return 200 with default values instead of 500
  }
}
