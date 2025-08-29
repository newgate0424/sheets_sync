import { NextApiRequest, NextApiResponse } from 'next';
import pool from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    switch (req.method) {
      case 'POST':
        console.log('🔧 กำลังแก้ไขและล้าง database...');

        // 1. ดูข้อมูลปัจจุบัน
        const [currentConfigs] = await pool.execute('SELECT * FROM sync_configs');
        console.log('📋 Current configs:', currentConfigs);

        // 2. ลบข้อมูลที่เสีย
        await pool.execute('DELETE FROM sync_configs');
        await pool.execute('DELETE FROM sync_logs');
        console.log('🗑️ ลบข้อมูลเก่าแล้ว');

        // 3. ลบตารางที่สร้างผิด
        try {
          await pool.execute('DROP TABLE IF EXISTS `A`');
          console.log('🗑️ ลบตาราง A ที่เสียแล้ว');
        } catch (e) {
          console.log('ไม่มีตาราง A ให้ลบ');
        }

        // 4. Reset auto increment
        await pool.execute('ALTER TABLE sync_configs AUTO_INCREMENT = 1');
        await pool.execute('ALTER TABLE sync_logs AUTO_INCREMENT = 1');

        return res.status(200).json({ 
          message: 'Database cleaned successfully. Please recreate your sync configurations.', 
          removedConfigs: (currentConfigs as any[]).length 
        });

      case 'GET':
        // Clean database when accessed via GET too (for browser access)
        console.log('🔧 [GET] กำลังแก้ไขและล้าง database...');

        // 1. ดูข้อมูลปัจจุบัน
        const [currentConfigsGet] = await pool.execute('SELECT * FROM sync_configs');
        console.log('📋 Current configs:', currentConfigsGet);

        // 2. ลบข้อมูลที่เสีย
        await pool.execute('DELETE FROM sync_configs');
        await pool.execute('DELETE FROM sync_logs');
        console.log('🗑️ ลบข้อมูลเก่าแล้ว');

        // 3. ลบตารางที่สร้างผิด
        try {
          await pool.execute('DROP TABLE IF EXISTS `A`');
          console.log('🗑️ ลบตาราง A ที่เสียแล้ว');
        } catch (e) {
          console.log('ไม่มีตาราง A ให้ลบ');
        }

        // 4. Reset auto increment
        await pool.execute('ALTER TABLE sync_configs AUTO_INCREMENT = 1');
        await pool.execute('ALTER TABLE sync_logs AUTO_INCREMENT = 1');

        return res.status(200).json({
          message: 'Database cleaned successfully via GET. Please recreate your sync configurations.',
          removedConfigs: (currentConfigsGet as any[]).length,
          success: true
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Fix database error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
}