import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { getSession } from 'next-auth/react';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { matrixId, employeeIds, validFrom, validTo } = req.body;

  if (!matrixId || !employeeIds || !validFrom || !validTo) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['matrixId', 'employeeIds', 'validFrom', 'validTo']
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate matrix exists and is active
    const matrixResult = await client.query(
      'SELECT id, status FROM evaluation_matrices WHERE id = $1',
      [matrixId]
    );

    if (matrixResult.rows.length === 0) {
      return res.status(404).json({ message: 'Matrix not found' });
    }

    if (matrixResult.rows[0].status !== 'active') {
      return res.status(400).json({ message: 'Matrix is not active' });
    }

    // Validate date range
    if (new Date(validFrom) >= new Date(validTo)) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    // Check for overlapping matrices for each employee
    const overlappingResult = await client.query(
      `SELECT DISTINCT employee_id 
       FROM evaluation_matrix_applicability
       WHERE employee_id = ANY($1)
         AND status = 'active'
         AND (
           (valid_from <= $2 AND valid_to >= $3)
           OR ($2 <= valid_to AND $3 >= valid_from)
         )`,
      [employeeIds, validTo, validFrom]
    );

    if (overlappingResult.rows.length > 0) {
      const overlappingEmployees = overlappingResult.rows.map(r => r.employee_id);
      return res.status(400).json({
        message: 'Some employees already have active matrices for this period',
        overlappingEmployees
      });
    }

    // Insert new applicability records
    const insertValues = employeeIds.map((employeeId: string) => ({
      matrix_id: matrixId,
      employee_id: employeeId,
      valid_from: validFrom,
      valid_to: validTo,
      status: 'active',
      assigned_by_employee_id: session.user.employeeId,
      created_by_system_user_id: session.user.email
    }));

    await client.query(
      `INSERT INTO evaluation_matrix_applicability 
       (matrix_id, employee_id, valid_from, valid_to, status, assigned_by_employee_id, created_by_system_user_id)
       SELECT * FROM json_populate_recordset(null::evaluation_matrix_applicability, $1)`,
      [JSON.stringify(insertValues)]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Matrix applied successfully',
      appliedTo: employeeIds.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying matrix:', error);
    res.status(500).json({ 
      message: 'Error applying matrix',
      error: error.message
    });
  } finally {
    client.release();
  }
} 