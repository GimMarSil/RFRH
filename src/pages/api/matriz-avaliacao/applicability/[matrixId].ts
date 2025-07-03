import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { matrixId } = req.query;

  if (!matrixId || Array.isArray(matrixId)) {
    return res.status(400).json({ message: 'Valid matrixId must be provided in the path' });
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT e.id, e.name, e.email, e.position, e.department
       FROM employees e
       INNER JOIN evaluation_matrix_applicability ema ON e.id = ema.employee_id
       WHERE ema.matrix_id = $1
       ORDER BY e.name`,
      [matrixId]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching matrix applicability:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
} 