import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { configId, page = '1', pageSize = '50', search } = req.query;

    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    const configIdNum = parseInt(configId as string);
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);

    if (isNaN(configIdNum) || isNaN(pageNum) || isNaN(pageSizeNum)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    if (pageNum < 1 || pageSizeNum < 1 || pageSizeNum > 1000) {
      return res.status(400).json({ error: 'Invalid page or pageSize' });
    }

    // Get sync config info
    console.log('1. Getting sync config...');
    const [configs] = await pool.execute(`
      SELECT id, name, table_name, row_count, last_sync_at
      FROM sync_configs 
      WHERE id = ? AND is_active = 1
    `, [configIdNum]);

    if ((configs as any[]).length === 0) {
      // If no config found, return a helpful response instead of error
      return res.status(200).json({ 
        success: false,
        error: 'Configuration not found',
        message: 'The configuration does not exist or is inactive',
        suggestion: 'Please create a sync configuration first',
        configId: configIdNum
      });
    }

    const config = (configs as any[])[0];

    // Check if table exists
    console.log('2. Checking if table exists...');
    const [tableCheck] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = ?
    `, [config.table_name]);

    const tableExists = (tableCheck as any[])[0].count > 0;

    if (!tableExists) {
      return res.status(200).json({ 
        success: false,
        error: 'Table not found',
        message: 'The table for this configuration does not exist. Please run sync first.',
        suggestion: 'Click the sync button to create and populate the table',
        configId: config.id,
        configName: config.name,
        tableName: config.table_name
      });
    }

    // Get table columns
    console.log('3. Getting table columns...');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION
    `, [config.table_name]);

    const columnList = (columns as any[]).map(col => col.COLUMN_NAME);

    // Build search condition
    let searchCondition = '';
    let searchParams: any[] = [];
    
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      const searchColumns = columnList.filter(col => 
        col !== 'id' && col !== 'synced_at' && 
        !col.toLowerCase().includes('created') && 
        !col.toLowerCase().includes('updated')
      );
      
      if (searchColumns.length > 0) {
        searchCondition = ' WHERE ' + searchColumns.map(col => 
          `\`${col}\` LIKE ?`
        ).join(' OR ');
        searchParams = searchColumns.map(() => `%${searchTerm}%`);
      }
    }

    // Get total row count (with search)
    console.log('4. Getting total row count...');
    const countQuery = `SELECT COUNT(*) as total FROM \`${config.table_name}\`${searchCondition}`;
    const [countResult] = await pool.execute(countQuery, searchParams);

    const totalRows = (countResult as any[])[0].total;
    const totalPages = Math.ceil(totalRows / pageSizeNum);

    // Get paginated data (with search)
    console.log('5. Getting paginated data...');
    const offset = (pageNum - 1) * pageSizeNum;
    
    const dataQuery = `
      SELECT * FROM \`${config.table_name}\`
      ${searchCondition}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...searchParams, pageSizeNum, offset];
    const [dataRows] = await pool.execute(dataQuery, dataParams);

    console.log(`Retrieved ${(dataRows as any[]).length} rows for page ${pageNum}${search ? ` with search: "${search}"` : ''}`);

    return res.status(200).json({
      success: true,
      data: {
        configName: config.name,
        tableName: config.table_name,
        columns: columnList,
        rows: dataRows,
        totalRows,
        currentPage: pageNum,
        totalPages
      },
      configId: config.id,
      pageSize: pageSizeNum,
      lastSyncAt: config.last_sync_at,
      searchTerm: search || ''
    });

  } catch (error) {
    console.error('Data view API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data',
      message: (error as Error).message
    });
  }
}
