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

  const { matrixId } = req.query;
  const { newValidFrom, newValidTo, employeeIds } = req.body;

  if (!matrixId || Array.isArray(matrixId)) {
    return res.status(400).json({ message: 'Valid matrixId must be provided in the path' });
  }

  if (!newValidFrom || !newValidTo) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['newValidFrom', 'newValidTo']
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the source matrix
    const matrixResult = await client.query(
      'SELECT * FROM evaluation_matrices WHERE id = $1',
      [matrixId]
    );

    if (matrixResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Matrix not found' });
    }

    const sourceMatrix = matrixResult.rows[0];

    // Create a new matrix with the same data but a new name
    const newMatrixResult = await client.query(
      `INSERT INTO evaluation_matrices 
       (name, description, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [
        `${sourceMatrix.name} (Copy)`,
        sourceMatrix.description,
        'draft',
        sourceMatrix.created_by
      ]
    );

    const newMatrix = newMatrixResult.rows[0];

    // Copy all criteria
    await client.query(
      `INSERT INTO evaluation_criteria 
       (matrix_id, name, description, weight, created_at, updated_at)
       SELECT $1, name, description, weight, NOW(), NOW()
       FROM evaluation_criteria
       WHERE matrix_id = $2`,
      [newMatrix.id, matrixId]
    );

    // Copy all applicability
    await client.query(
      `INSERT INTO evaluation_matrix_applicability 
       (matrix_id, employee_id, created_at, updated_at)
       SELECT $1, employee_id, NOW(), NOW()
       FROM evaluation_matrix_applicability
       WHERE matrix_id = $2`,
      [newMatrix.id, matrixId]
    );

    // Validate date range
    if (new Date(newValidFrom) >= new Date(newValidTo)) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    // Copy matrix using the stored procedure
    const newMatrixId = await client.query(
      `SELECT fn_copy_matrix($1, $2, $3, $4, $5)`,
      [
        matrixId,
        newValidFrom,
        newValidTo,
        session.user.email,
        session.user.employeeId
      ]
    );

    // If employeeIds is provided, create specific versions for those employees
    if (employeeIds && employeeIds.length > 0) {
      for (const employeeId of employeeIds) {
        await client.query(
          `SELECT fn_create_employee_specific_matrix($1, $2, $3, $4, $5, $6)`,
          [
            newMatrixId.rows[0].fn_copy_matrix,
            employeeId,
            newValidFrom,
            newValidTo,
            session.user.email,
            session.user.employeeId
          ]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Matrix copied successfully',
      matrix: newMatrix
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error copying matrix:', error);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
} 