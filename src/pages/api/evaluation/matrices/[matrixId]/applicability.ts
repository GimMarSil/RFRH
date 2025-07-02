import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { canAccessMatrix, canManageMatrix } from '../../../../../lib/evaluation/auth';
import { z } from 'zod';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper to get authenticated user ID
async function getAuthenticatedSystemUserId(req: NextApiRequest): Promise<string | null> {
  // TODO: Replace with actual MSAL or equivalent authentication logic
  console.warn('Using placeholder system user ID for audit logs in matrices API. Integrate actual authentication.');
  return 'system-placeholder-user-id';
}

// Helper to get the selected Employee ID
async function getSelectedEmployeeId(req: NextApiRequest): Promise<string | null> {
  const selectedEmployeeId = req.headers['x-selected-employee-id'] as string;
  if (!selectedEmployeeId) {
    console.warn('X-Selected-Employee-ID header not found for matrices API.');
    return null;
  }
  return selectedEmployeeId;
}

// Validation schemas
const applicabilitySchema = z.object({
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be specified'),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid from date must be in YYYY-MM-DD format'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid to date must be in YYYY-MM-DD format')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { matrixId } = req.query;

  if (!matrixId || Array.isArray(matrixId)) {
    return res.status(400).json({ message: 'Invalid matrix ID' });
  }

  let authenticatedSystemUserId: string | null = null;
  let selectedEmployeeId: string | null = null;

  try {
    authenticatedSystemUserId = await getAuthenticatedSystemUserId(req);
    if (!authenticatedSystemUserId) {
      return res.status(401).json({ message: 'Unauthorized: Authenticated system user ID not available.' });
    }

    selectedEmployeeId = await getSelectedEmployeeId(req);
    if (!selectedEmployeeId && method !== 'GET') {
      return res.status(403).json({ message: 'Forbidden: Selected Employee ID required for matrix operations.' });
    }
  } catch (authError) {
    console.error('Authentication error in matrices API:', authError);
    return res.status(500).json({ message: 'Authentication failed.' });
  }

  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_user_id = $1`, [authenticatedSystemUserId]);

    if (method === 'GET') {
      // Get matrix applicability
      try {
        const result = await client.query(
          `SELECT 
            ema.employee_id,
            ema.assigned_by_employee_id,
            ema.assigned_at,
            e.name as employee_name,
            e.department_id as employee_department_id,
            e.business_unit_id as employee_business_unit_id,
            a.name as assigned_by_name,
            a.department_id as assigned_by_department_id,
            a.business_unit_id as assigned_by_business_unit_id
           FROM evaluation_matrix_applicability ema
           JOIN employees e ON e.id = ema.employee_id
           JOIN employees a ON a.id = ema.assigned_by_employee_id
           WHERE ema.matrix_id = $1
           ORDER BY e.name`,
          [matrixId]
        );

        return res.status(200).json(result.rows);
      } catch (error) {
        console.error('Error fetching matrix applicability:', error);
        return res.status(500).json({ message: 'Error fetching matrix applicability', error: error.message });
      }
    } else if (method === 'POST') {
      // Add matrix applicability
      try {
        const { employee_ids } = req.body;

        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
          return res.status(400).json({ message: 'Invalid employee_ids array' });
        }

        await client.query('BEGIN');

        // Check if matrix exists and is active
        const matrixCheck = await client.query(
          'SELECT id FROM evaluation_matrices WHERE id = $1 AND status = $2',
          [matrixId, 'active']
        );

        if (matrixCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Active matrix not found' });
        }

        // Insert applicability records
        for (const employeeId of employee_ids) {
          await client.query(
            `INSERT INTO evaluation_matrix_applicability 
             (matrix_id, employee_id, assigned_by_employee_id, assigned_at, 
              created_by_user_id, updated_by_user_id)
             VALUES ($1, $2, $3, NOW(), $4, $4)
             ON CONFLICT (matrix_id, employee_id) DO UPDATE SET
               assigned_by_employee_id = EXCLUDED.assigned_by_employee_id,
               assigned_at = NOW(),
               updated_by_user_id = EXCLUDED.updated_by_user_id`,
            [matrixId, employeeId, selectedEmployeeId, authenticatedSystemUserId]
          );
        }

        await client.query('COMMIT');

        // Fetch updated applicability records
        const updatedResult = await client.query(
          `SELECT 
            ema.employee_id,
            ema.assigned_by_employee_id,
            ema.assigned_at,
            e.name as employee_name,
            e.department_id as employee_department_id,
            e.business_unit_id as employee_business_unit_id,
            a.name as assigned_by_name,
            a.department_id as assigned_by_department_id,
            a.business_unit_id as assigned_by_business_unit_id
           FROM evaluation_matrix_applicability ema
           JOIN employees e ON e.id = ema.employee_id
           JOIN employees a ON a.id = ema.assigned_by_employee_id
           WHERE ema.matrix_id = $1
           ORDER BY e.name`,
          [matrixId]
        );

        return res.status(200).json(updatedResult.rows);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating matrix applicability:', error);
        return res.status(500).json({ message: 'Error updating matrix applicability', error: error.message });
      }
    } else if (method === 'DELETE') {
      // Remove matrix applicability
      try {
        const { employee_ids } = req.body;

        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
          return res.status(400).json({ message: 'Invalid employee_ids array' });
        }

        await client.query('BEGIN');

        // Delete applicability records
        await client.query(
          'DELETE FROM evaluation_matrix_applicability WHERE matrix_id = $1 AND employee_id = ANY($2)',
          [matrixId, employee_ids]
        );

        await client.query('COMMIT');

        return res.status(200).json({ message: 'Matrix applicability removed successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error removing matrix applicability:', error);
        return res.status(500).json({ message: 'Error removing matrix applicability', error: error.message });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error('General API handler error in matrices API:', error);
    return res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
  } finally {
    client.release();
  }
} 