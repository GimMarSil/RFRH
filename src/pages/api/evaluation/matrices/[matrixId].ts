import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { canAccessMatrix, canManageMatrix } from '../../../../lib/evaluation/auth';
import { validateMatrixInput } from '../../../../lib/evaluation/validation';
import { withAuth, AuthenticatedRequest, isAdmin, isManager } from '../../../../middleware/auth';

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

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { matrixId } = req.query;

  if (!matrixId || Array.isArray(matrixId)) {
    res.status(400).json({ message: 'Valid matrixId must be provided' });
    return;
  }

  const client = await pool.connect();
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (method === 'GET') {
      // Get matrix details
      const query = `
        SELECT 
          em.*,
          json_agg(
            json_build_object(
              'id', ec.id,
              'name', ec.name,
              'description', ec.description,
              'weight', ec.weight,
              'is_competency_gap_critical', ec.is_competency_gap_critical,
              'min_score_possible', ec.min_score_possible,
              'max_score_possible', ec.max_score_possible
            )
          ) as criteria
        FROM evaluation_matrices em
        LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
        WHERE em.id = $1
        GROUP BY em.id
      `;

      const result = await client.query(query, [matrixId]);

      if (result.rows.length === 0) {
        res.status(404).json({ message: 'Matrix not found' });
        return;
      }

      const matrix = result.rows[0];

      // Check access permissions
      if (!isAdmin(req.user.roles)) {
        if (isManager(req.user.roles)) {
          // Check if user is the manager who created the matrix
          if (matrix.created_by_manager_id !== req.user.id) {
            res.status(403).json({ message: 'Not authorized to view this matrix' });
            return;
          }
        } else {
          res.status(403).json({ message: 'Not authorized to view matrices' });
          return;
        }
      }

      res.status(200).json(matrix);
      return;

    } else if (method === 'PUT') {
      // Update matrix
      const { title, description, valid_from, valid_to, status, criteria } = req.body;

      // Validate input
      const validationResult = await validateMatrixInput(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: 'Invalid input', errors: validationResult.errors });
        return;
      }

      await client.query('BEGIN');

      // Check if matrix exists and user has access
      const matrixCheck = await client.query(
        'SELECT created_by_manager_id FROM evaluation_matrices WHERE id = $1',
        [matrixId]
      );

      if (matrixCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Matrix not found' });
        return;
      }

      const matrix = matrixCheck.rows[0];

      // Check permissions
      if (!isAdmin(req.user.roles)) {
        if (isManager(req.user.roles)) {
          // Manager can only update their own matrices
          if (matrix.created_by_manager_id !== req.user.id) {
            await client.query('ROLLBACK');
            res.status(403).json({ message: 'Not authorized to update this matrix' });
            return;
          }
        } else {
          await client.query('ROLLBACK');
          res.status(403).json({ message: 'Only managers can update matrices' });
          return;
        }
      }

      // Update matrix
      const updateQuery = `
        UPDATE evaluation_matrices 
        SET 
          title = $1,
          description = $2,
          valid_from = $3,
          valid_to = $4,
          status = $5,
          updated_by_user_id = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        title,
        description,
        valid_from,
        valid_to,
        status || 'active',
        req.user.id,
        matrixId
      ]);

      // Update criteria if provided
      if (criteria && Array.isArray(criteria)) {
        // Delete existing criteria
        await client.query('DELETE FROM evaluation_criteria WHERE matrix_id = $1', [matrixId]);

        // Insert new criteria
        for (const criterion of criteria) {
          await client.query(
            `INSERT INTO evaluation_criteria (
              matrix_id,
              name,
              description,
              weight,
              is_competency_gap_critical,
              min_score_possible,
              max_score_possible,
              created_by_user_id,
              updated_by_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [
              matrixId,
              criterion.name,
              criterion.description,
              criterion.weight,
              criterion.is_competency_gap_critical,
              criterion.min_score_possible,
              criterion.max_score_possible,
              req.user.id
            ]
          );
        }
      }

      await client.query('COMMIT');
      res.status(200).json(result.rows[0]);
      return;

    } else if (method === 'DELETE') {
      await client.query('BEGIN');

      // Check if matrix exists and user has access
      const matrixCheck = await client.query(
        'SELECT created_by_manager_id FROM evaluation_matrices WHERE id = $1',
        [matrixId]
      );

      if (matrixCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ message: 'Matrix not found' });
        return;
      }

      const matrix = matrixCheck.rows[0];

      // Check permissions
      if (!isAdmin(req.user.roles)) {
        if (isManager(req.user.roles)) {
          // Manager can only delete their own matrices
          if (matrix.created_by_manager_id !== req.user.id) {
            await client.query('ROLLBACK');
            res.status(403).json({ message: 'Not authorized to delete this matrix' });
            return;
          }
        } else {
          await client.query('ROLLBACK');
          res.status(403).json({ message: 'Only managers can delete matrices' });
          return;
        }
      }

      // Check if matrix is being used in any evaluations
      const usageCheck = await client.query(
        `SELECT 1 FROM (
          SELECT matrix_id FROM employee_evaluations WHERE matrix_id = $1
          UNION
          SELECT matrix_id FROM self_evaluations WHERE matrix_id = $1
        ) as used_matrices`,
        [matrixId]
      );

      if (usageCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: 'Cannot delete matrix that is being used in evaluations' });
        return;
      }

      // Delete matrix
      const result = await client.query(
        'DELETE FROM evaluation_matrices WHERE id = $1 RETURNING *',
        [matrixId]
      );

      await client.query('COMMIT');
      res.status(200).json({ message: 'Matrix deleted successfully', matrix: result.rows[0] });
      return;

    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed for this route.`);
      return;
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error in matrix API:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
    return;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default withAuth(handler); 