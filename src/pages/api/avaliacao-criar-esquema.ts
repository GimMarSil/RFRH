import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed, please use POST.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'evaluation-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    await client.query(schemaSQL);

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true, 
      message: 'Evaluation schema created successfully.' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating evaluation schema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  } finally {
    client.release();
  }
} 