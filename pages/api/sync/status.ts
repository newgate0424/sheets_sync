import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { configId } = req.query;

    // ดึงข้อมูลการซิงค์ล่าสุด
    const [syncLogs] = await pool.execute(`
      SELECT sl.*, sc.name as config_name, sc.table_name
      FROM sync_logs sl
      JOIN sync_configs sc ON sl.config_id = sc.id
      ${configId ? 'WHERE sl.config_id = ?' : ''}
      ORDER BY sl.created_at DESC
      LIMIT 50
    `, configId ? [configId] : []);

    // สถิติทั่วไป
    const [generalStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_configs,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_configs,
        SUM(row_count) as total_rows,
        MAX(last_sync_at) as last_global_sync
      FROM sync_configs
    `);

    // สถิติการซิงค์ในแต่ละตาราง (รวม tracking info) - ใช้ subquery แทน LATERAL JOIN
    const [tableStats] = await pool.execute(`
      SELECT 
        sc.id,
        sc.name,
        sc.table_name,
        sc.row_count,
        sc.last_sync_at,
        0 as actual_rows,
        0 as rows_with_hash,
        0 as rows_with_index
      FROM sync_configs sc
      WHERE sc.is_active = 1
      ORDER BY sc.name
    `);

    // สถิติล่าสุดของแต่ละ config
    const [recentActivity] = await pool.execute(`
      SELECT 
        sl.config_id,
        sc.name,
        sl.status,
        sl.message,
        sl.rows_synced,
        sl.created_at,
        ROW_NUMBER() OVER (PARTITION BY sl.config_id ORDER BY sl.created_at DESC) as rn
      FROM sync_logs sl
      JOIN sync_configs sc ON sl.config_id = sc.id
      WHERE sc.is_active = 1
      ORDER BY sl.created_at DESC
    `);

    const recentByConfig = (recentActivity as any[])
      .filter(log => log.rn === 1)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        syncLogs: syncLogs,
        generalStats: (generalStats as any[])[0],
        tableStats: tableStats,
        recentActivity: recentByConfig
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}
