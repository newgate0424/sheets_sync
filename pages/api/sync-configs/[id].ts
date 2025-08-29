import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid config ID' });
  }

  const configId = parseInt(id, 10);
  if (isNaN(configId)) {
    return res.status(400).json({ error: 'Config ID must be a number' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getConfig(req, res, configId);
      case 'PATCH':
        return await updateConfig(req, res, configId);
      case 'DELETE':
        return await deleteConfig(req, res, configId);
      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function getConfig(req: NextApiRequest, res: NextApiResponse, configId: number) {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id,
        name,
        sheet_url,
        sheet_name,
        table_name,
        columns,
        is_active,
        last_sync_at,
        row_count,
        created_at,
        updated_at
      FROM sync_configs 
      WHERE id = ?
    `, [configId]);

    const configs = rows as any[];
    if (configs.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const config = configs[0];

    // Parse JSON columns
    const parsedConfig = {
      ...config,
      columns: config.columns ? JSON.parse(config.columns) : {},
      is_active: Boolean(config.is_active)
    };

    return res.status(200).json(parsedConfig);
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
}

async function updateConfig(req: NextApiRequest, res: NextApiResponse, configId: number) {
  try {
    const { name, sheet_url, is_active } = req.body;

    if (!name || !sheet_url) {
      return res.status(400).json({ 
        error: 'Name and sheet_url are required' 
      });
    }

    // Validate sheet URL
    if (!sheet_url.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({ 
        error: 'Invalid Google Sheets URL' 
      });
    }

    // Check if config exists
    const [existingRows] = await pool.execute(
      'SELECT id FROM sync_configs WHERE id = ?', 
      [configId]
    );

    const existingConfigs = existingRows as any[];
    if (existingConfigs.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Update the configuration
    await pool.execute(`
      UPDATE sync_configs 
      SET 
        name = ?,
        sheet_url = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, sheet_url, is_active ? 1 : 0, configId]);

    // Return updated config
    const [updatedRows] = await pool.execute(`
      SELECT 
        id,
        name,
        sheet_url,
        sheet_name,
        table_name,
        columns,
        is_active,
        last_sync_at,
        row_count,
        created_at,
        updated_at
      FROM sync_configs 
      WHERE id = ?
    `, [configId]);

    const updatedConfigs = updatedRows as any[];
    const updatedConfig = updatedConfigs[0];

    const parsedConfig = {
      ...updatedConfig,
      columns: updatedConfig.columns ? JSON.parse(updatedConfig.columns) : {},
      is_active: Boolean(updatedConfig.is_active)
    };

    return res.status(200).json(parsedConfig);
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

async function deleteConfig(req: NextApiRequest, res: NextApiResponse, configId: number) {
  try {
    // Check if config exists
    const [existingRows] = await pool.execute(
      'SELECT id, table_name FROM sync_configs WHERE id = ?', 
      [configId]
    );

    const existingConfigs = existingRows as any[];
    if (existingConfigs.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const existingConfig = existingConfigs[0];

    // Delete the configuration
    await pool.execute('DELETE FROM sync_configs WHERE id = ?', [configId]);

    // Optionally, you might want to drop the associated table
    // Be careful with this in production!
    if (existingConfig.table_name) {
      try {
        await pool.execute(`DROP TABLE IF EXISTS \`${existingConfig.table_name}\``);
      } catch (error) {
        console.warn(`Failed to drop table ${existingConfig.table_name}:`, error);
        // Continue anyway, as the config is deleted
      }
    }

    return res.status(200).json({ 
      message: 'Configuration deleted successfully',
      id: configId
    });
  } catch (error) {
    console.error('Error deleting config:', error);
    throw error;
  }
}
