import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function getAuthenticatedSystemUserId(req: NextApiRequest): Promise<string | null> {
  // TODO: Replace with actual MSAL or equivalent authentication logic
  console.warn('Using placeholder system user ID for audit logs in matrix criteria API. Integrate actual authentication.');
  return 'system-placeholder-user-id';
}

async function getSelectedEmployeeId(req: NextApiRequest): Promise<string | null> {
  const selectedEmployeeId = req.headers['x-selected-employee-id'] as string;
  if (!selectedEmployeeId) {
    console.warn('X-Selected-Employee-ID header not found for matrix criteria API.');
    return null;
  }
  return selectedEmployeeId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { matrixId } = req.query;

  if (!matrixId || Array.isArray(matrixId)) {
    return res.status(400).json({ message: 'Valid matrixId must be provided in the path.' });
  }

  let authenticatedSystemUserId: string | null = null;
  let selectedEmployeeId: string | null = null;

  try {
    authenticatedSystemUserId = await getAuthenticatedSystemUserId(req);
    if (!authenticatedSystemUserId) {
      return res.status(401).json({ message: 'Unauthorized: Authenticated system user ID not available.' });
    }

    selectedEmployeeId = await getSelectedEmployeeId(req);
    if (!selectedEmployeeId && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      return res.status(403).json({ message: 'Forbidden: Selected Employee ID required for this operation.' });
    }
  } catch (authError) {
    console.error('Authentication error in matrix criteria API:', authError);
    return res.status(500).json({ message: 'Authentication failed.' });
  }

  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_user_id = $1`, [authenticatedSystemUserId]);

    if (method === 'GET') {
      // Get criteria for a matrix
      try {
        const result = await client.query(
          `SELECT c.*, 
           COUNT(e.id) as evaluation_count,
           AVG(e.score) as average_score
           FROM evaluation_criteria c
           LEFT JOIN employee_evaluations e ON c.id = e.criterion_id
           WHERE c.matrix_id = $1
           GROUP BY c.id
           ORDER BY c.weight DESC, c.name`,
          [matrixId]
        );

        return res.status(200).json(result.rows);
      } catch (dbError) {
        console.error(`Error fetching criteria for matrix ${matrixId}:`, dbError);
        return res.status(500).json({ message: `Error fetching criteria`, error: dbError.message });
      }
    } else if (method === 'POST') {
      // Add new criteria
      try {
        const { name, description, weight, is_competency_gap_critical, min_score_possible, max_score_possible } = req.body;

        if (!name || !weight) {
          return res.status(400).json({ message: 'Missing required fields: name, weight.' });
        }

        await client.query('BEGIN');

        // Check if matrix exists and is active
        const matrixCheck = await client.query(
          'SELECT id FROM evaluation_matrices WHERE id = $1 AND status = $2',
          [matrixId, 'active']
        );

        if (matrixCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Matrix not found or not active.' });
        }

        // Insert new criterion
        const result = await client.query(
          `INSERT INTO evaluation_criteria 
           (matrix_id, name, description, weight, is_competency_gap_critical, 
            min_score_possible, max_score_possible, created_by_user_id, updated_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
           RETURNING *`,
          [
            matrixId,
            name,
            description,
            weight,
            is_competency_gap_critical || false,
            min_score_possible || 0,
            max_score_possible || 100,
            authenticatedSystemUserId
          ]
        );

        await client.query('COMMIT');

        return res.status(201).json(result.rows[0]);
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error(`Error adding criterion for matrix ${matrixId}:`, dbError);
        return res.status(500).json({ message: `Error adding criterion`, error: dbError.message });
      }
    } else if (method === 'PUT') {
      // Update existing criteria
      try {
        const { criteria } = req.body;

        if (!criteria || !Array.isArray(criteria)) {
          return res.status(400).json({ message: 'Missing required field: criteria array.' });
        }

        await client.query('BEGIN');

        // Check if matrix exists and is active
        const matrixCheck = await client.query(
          'SELECT id FROM evaluation_matrices WHERE id = $1 AND status = $2',
          [matrixId, 'active']
        );

        if (matrixCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Matrix not found or not active.' });
        }

        // Update each criterion
        for (const criterion of criteria) {
          if (!criterion.id || !criterion.name || !criterion.weight) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Each criterion must have id, name, and weight.' });
          }

          await client.query(
            `UPDATE evaluation_criteria 
             SET name = $1, 
                 description = $2, 
                 weight = $3, 
                 is_competency_gap_critical = $4,
                 min_score_possible = $5,
                 max_score_possible = $6,
                 updated_by_user_id = $7,
                 updated_at = NOW()
             WHERE id = $8 AND matrix_id = $9`,
            [
              criterion.name,
              criterion.description,
              criterion.weight,
              criterion.is_competency_gap_critical || false,
              criterion.min_score_possible || 0,
              criterion.max_score_possible || 100,
              authenticatedSystemUserId,
              criterion.id,
              matrixId
            ]
          );
        }

        await client.query('COMMIT');

        // Fetch updated criteria
        const updatedCriteria = await client.query(
          `SELECT c.*, 
           COUNT(e.id) as evaluation_count,
           AVG(e.score) as average_score
           FROM evaluation_criteria c
           LEFT JOIN employee_evaluations e ON c.id = e.criterion_id
           WHERE c.matrix_id = $1
           GROUP BY c.id
           ORDER BY c.weight DESC, c.name`,
          [matrixId]
        );

        return res.status(200).json(updatedCriteria.rows);
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error(`Error updating criteria for matrix ${matrixId}:`, dbError);
        return res.status(500).json({ message: `Error updating criteria`, error: dbError.message });
      }
    } else if (method === 'DELETE') {
      // Delete specific criteria
      try {
        const { criterion_ids } = req.body;

        if (!criterion_ids || !Array.isArray(criterion_ids)) {
          return res.status(400).json({ message: 'Missing required field: criterion_ids.' });
        }

        await client.query('BEGIN');

        // Check if any criteria have associated evaluations
        const evaluationCheck = await client.query(
          `SELECT COUNT(*) FROM employee_evaluations 
           WHERE criterion_id = ANY($1)`,
          [criterion_ids]
        );

        if (evaluationCheck.rows[0].count > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'Cannot delete criteria that have associated evaluations.',
            evaluation_count: evaluationCheck.rows[0].count
          });
        }

        // Delete criteria
        const result = await client.query(
          `DELETE FROM evaluation_criteria 
           WHERE id = ANY($1) AND matrix_id = $2
           RETURNING *`,
          [criterion_ids, matrixId]
        );

        await client.query('COMMIT');

        return res.status(200).json({ 
          message: 'Criteria deleted successfully.',
          deleted_count: result.rowCount
        });
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error(`Error deleting criteria for matrix ${matrixId}:`, dbError);
        return res.status(500).json({ message: `Error deleting criteria`, error: dbError.message });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed for this route.`);
    }
  } catch (error) {
    console.error('General API handler error in matrix criteria API:', error);
    return res.status(500).json({ message: 'An unexpected error occurred in matrix criteria API.', error: error.message });
  } finally {
    if (client) client.release();
  }
} 