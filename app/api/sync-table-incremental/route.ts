import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getGoogleSheetsClient } from '@/lib/googleSheets';
import crypto from 'crypto';

// สร้างตาราง metadata สำหรับเก็บ checksum
async function ensureMetadataTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dataset_name VARCHAR(255) NOT NULL,
      table_name VARCHAR(255) NOT NULL,
      row_hash VARCHAR(64) NOT NULL,
      sheet_row_number INT NOT NULL,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_row (dataset_name, table_name, sheet_row_number),
      INDEX idx_hash (row_hash)
    )
  `);
}

// สร้าง hash จากข้อมูลแถว
function createRowHash(row: any[]): string {
  const rowString = row.join('|');
  return crypto.createHash('sha256').update(rowString).digest('hex');
}

// PUT - Incremental Sync ข้อมูลจาก Google Sheets
export async function PUT(request: NextRequest) {
  try {
    const { dataset, tableName } = await request.json();
    
    if (!dataset || !tableName) {
      return NextResponse.json({ error: 'Dataset and table name are required' }, { status: 400 });
    }

    const connection = await pool.getConnection();

    // สร้างตาราง metadata
    await ensureMetadataTable(connection);

    // ดึง sync config
    const [configs]: any = await connection.query(
      'SELECT * FROM sync_config WHERE dataset_name = ? AND table_name = ?',
      [dataset, tableName]
    );

    if (configs.length === 0) {
      connection.release();
      return NextResponse.json({ error: 'Sync config not found' }, { status: 404 });
    }

    const config = configs[0];
    const sheets = await getGoogleSheetsClient();

    // ดึงข้อมูลจาก Google Sheets แบบ batch (รองรับข้อมูลล้านแถว)
    const batchSize = 10000;
    let allRows: any[] = [];
    let startRow = 2; // เริ่มจากแถวที่ 2 (หลังหัวตาราง)
    let hasMore = true;

    // ดึง header ก่อน
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheet_id,
      range: `${config.sheet_name}!A1:ZZ1`,
    });
    const headers = headerResponse.data.values?.[0] || [];

    if (headers.length === 0) {
      connection.release();
      return NextResponse.json({ error: 'No headers found' }, { status: 404 });
    }

    console.log(`Starting incremental sync for ${tableName}...`);

    // ดึงข้อมูลแบบ batch
    while (hasMore) {
      const endRow = startRow + batchSize - 1;
      const range = `${config.sheet_name}!A${startRow}:ZZ${endRow}`;
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheet_id,
        range: range,
      });

      const batchRows = response.data.values || [];
      
      if (batchRows.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...batchRows.map((row, idx) => ({ 
          data: row, 
          rowNumber: startRow + idx 
        })));
        startRow += batchSize;
        
        // ถ้าได้น้อยกว่า batch size แสดงว่าหมดแล้ว
        if (batchRows.length < batchSize) {
          hasMore = false;
        }
      }

      console.log(`Fetched ${allRows.length} rows so far...`);
    }

    console.log(`Total rows fetched: ${allRows.length}`);

    // ดึง metadata เก่า
    const [existingMetadata]: any = await connection.query(
      'SELECT sheet_row_number, row_hash FROM sync_metadata WHERE dataset_name = ? AND table_name = ?',
      [dataset, tableName]
    );

    const existingHashes = new Map(
      existingMetadata.map((m: any) => [m.sheet_row_number, m.row_hash])
    );

    const currentSheetRows = new Set<number>();
    const rowsToInsert: any[] = [];
    const rowsToUpdate: any[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // ตรวจสอบแต่ละแถวว่ามีการเปลี่ยนแปลงหรือไม่
    for (const { data, rowNumber } of allRows) {
      currentSheetRows.add(rowNumber);
      const hash = createRowHash(data);
      const existingHash = existingHashes.get(rowNumber);

      if (!existingHash) {
        // แถวใหม่
        rowsToInsert.push({ data, rowNumber, hash });
      } else if (existingHash !== hash) {
        // แถวที่มีการแก้ไข
        rowsToUpdate.push({ data, rowNumber, hash });
      }
      // ถ้า hash เหมือนกัน = ไม่มีการเปลี่ยนแปลง ข้าม
    }

    // หาแถวที่ถูกลบ (อยู่ใน metadata แต่ไม่อยู่ใน sheet)
    const rowsToDelete: number[] = [];
    for (const [rowNum] of existingHashes) {
      const rowNumber = Number(rowNum);
      if (!currentSheetRows.has(rowNumber)) {
        rowsToDelete.push(rowNumber);
      }
    }

    console.log(`Changes detected: ${rowsToInsert.length} new, ${rowsToUpdate.length} updated, ${rowsToDelete.length} deleted`);

    // ทำการ Insert แถวใหม่
    if (rowsToInsert.length > 0) {
      const columnNames = headers.map((h: string) => 
        `\`${h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}\``
      ).join(', ');

      // Insert แบบ batch เพื่อประสิทธิภาพ
      const batchInsertSize = 1000;
      for (let i = 0; i < rowsToInsert.length; i += batchInsertSize) {
        const batch = rowsToInsert.slice(i, i + batchInsertSize);
        
        const values = batch.map(({ data }) => {
          const vals = headers.map((_: any, index: number) => {
            const val = data[index];
            return val !== undefined && val !== '' ? connection.escape(val) : 'NULL';
          }).join(', ');
          return `(${vals})`;
        }).join(', ');

        await connection.query(`INSERT INTO \`${dataset}\`.\`${tableName}\` (${columnNames}) VALUES ${values}`);
        
        // Insert metadata
        for (const { rowNumber, hash } of batch) {
          await connection.query(
            'INSERT INTO sync_metadata (dataset_name, table_name, row_hash, sheet_row_number) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE row_hash = ?, last_seen = NOW()',
            [dataset, tableName, hash, rowNumber, hash]
          );
        }
        
        insertedCount += batch.length;
        console.log(`Inserted ${insertedCount}/${rowsToInsert.length} rows`);
      }
    }

    // ทำการ Update แถวที่แก้ไข
    if (rowsToUpdate.length > 0) {
      for (const { data, rowNumber, hash } of rowsToUpdate) {
        // หา primary key หรือใช้ sheet_row_number
        const setClause = headers.map((h: string, index: number) => {
          const colName = h.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          const val = data[index];
          return `\`${colName}\` = ${val !== undefined && val !== '' ? connection.escape(val) : 'NULL'}`;
        }).join(', ');

        // ใช้ subquery หา id จาก metadata
        await connection.query(`
          UPDATE \`${dataset}\`.\`${tableName}\` t
          INNER JOIN sync_metadata m ON m.dataset_name = ? AND m.table_name = ? AND m.sheet_row_number = ?
          SET ${setClause}
          WHERE t.id = (
            SELECT id FROM \`${dataset}\`.\`${tableName}\` 
            WHERE id = t.id 
            LIMIT 1
          )
        `, [dataset, tableName, rowNumber]);

        // Update metadata
        await connection.query(
          'UPDATE sync_metadata SET row_hash = ?, last_seen = NOW() WHERE dataset_name = ? AND table_name = ? AND sheet_row_number = ?',
          [hash, dataset, tableName, rowNumber]
        );
        
        updatedCount++;
      }
      console.log(`Updated ${updatedCount} rows`);
    }

    // ทำการลบแถวที่หายไป
    if (rowsToDelete.length > 0) {
      for (const rowNumber of rowsToDelete) {
        // ลบจากตารางหลัก (ต้องหาวิธีเชื่อมโยงกับ sheet_row_number)
        // เนื่องจากไม่มี sheet_row_number ในตารางหลัก ให้เก็บไว้ใน metadata และทำ soft delete
        await connection.query(
          'DELETE FROM sync_metadata WHERE dataset_name = ? AND table_name = ? AND sheet_row_number = ?',
          [dataset, tableName, rowNumber]
        );
        deletedCount++;
      }
      console.log(`Deleted ${deletedCount} rows from metadata`);
    }

    // อัพเดท last_sync
    await connection.query(
      'UPDATE sync_config SET last_sync = NOW() WHERE dataset_name = ? AND table_name = ?',
      [dataset, tableName]
    );

    connection.release();

    return NextResponse.json({ 
      success: true, 
      message: `Incremental sync completed`,
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        total: allRows.length
      }
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
