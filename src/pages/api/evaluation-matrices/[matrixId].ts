import { NextApiResponse } from 'next';
import { Pool } from 'pg';
import { withAuth, AuthenticatedRequest, isAdmin, getUserDirectReports } from '../../../middleware/auth';
import { validateMatrixInput } from '../../../lib/evaluation/validation';
import { validate as validateUUID } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper function to check if the user can manage the matrix
async function canUserManageMatrix(
  client: any,
  loggedInUserUpn: string,
  loggedInUserRoles: string[],
  matrixId: string,
  token: string | undefined
): Promise<{ authorized: boolean; matrix?: any; creatorUpn?: string, statusCode?: number, message?: string }> {
  if (isAdmin(loggedInUserRoles)) {
    const matrixRes = await client.query('SELECT *, created_by_manager_id as manager_employee_number FROM evaluation_matrices WHERE id = $1', [matrixId]);
    if (matrixRes.rows.length === 0) return { authorized: false, statusCode: 404, message: 'Matrix not found' };
    return { authorized: true, matrix: matrixRes.rows[0] };
  }

  const matrixQuery = `
    SELECT em.*, e.user_id as creator_upn, em.created_by_manager_id as manager_employee_number
    FROM evaluation_matrices em
    JOIN employees e ON em.created_by_manager_id = e.employee_number
    WHERE em.id = $1
  `;
  const matrixResult = await client.query(matrixQuery, [matrixId]);

  if (matrixResult.rows.length === 0) {
    return { authorized: false, statusCode: 404, message: 'Matrix not found' };
  }
  const matrix = matrixResult.rows[0];
  const creatorUpn = matrix.creator_upn;

  if (loggedInUserUpn === creatorUpn) {
    return { authorized: true, matrix, creatorUpn };
  }

  // Check if logged-in user manages the creator
  if (token) {
    try {
      const directReports = await getUserDirectReports(token, loggedInUserUpn); // Get reports of the logged-in user
      if (directReports.some(report => report.userPrincipalName === creatorUpn)) {
        return { authorized: true, matrix, creatorUpn };
      }
    } catch (error) {
      console.error('Error fetching direct reports for matrix authorization:', error);
      // Potentially fall through or return a specific error if Graph call fails
      return { authorized: false, statusCode: 500, message: 'Could not verify manager relationship due to Graph API error.' };
    }
  }
  
  return { authorized: false, matrix, creatorUpn, statusCode: 403, message: 'Not authorized to manage this matrix' };
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;
  const { matrixId } = req.query;
  const loggedInUserUpn = req.user?.id; // UPN of the authenticated user

  if (!loggedInUserUpn) {
    res.status(401).json({ message: 'Authentication required, user UPN missing.' });
    return;
  }

  if (!matrixId || typeof matrixId !== 'string' || matrixId.toLowerCase() === 'undefined') {
    res.status(400).json({ message: 'Valid matrixId must be provided and cannot be \'undefined\'.' });
    return;
  }

  // Validate if matrixId is a valid UUID
  if (!validateUUID(matrixId)) {
    res.status(400).json({ message: 'Invalid matrixId format. Must be a valid UUID.' });
    return;
  }

  const client = await pool.connect();
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

    if (method === 'GET') {
      const authResult = await canUserManageMatrix(client, loggedInUserUpn, req.user.roles, matrixId, token);
      if (!authResult.authorized) {
        res.status(authResult.statusCode || 403).json({ message: authResult.message || 'Not authorized' });
        return;
      }
      const matrixToReturn = authResult.matrix;

      const query = `
        SELECT 
          em.*,
          creator_emp.name as employee_name,
          creator_emp.company_name as company_name,
          creator_emp.employee_number as manager_profile_employee_number, -- This is the employee_number of the manager who created it
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
          ) FILTER (WHERE ec.id IS NOT NULL) as criteria
        FROM evaluation_matrices em
        LEFT JOIN employees creator_emp ON em.created_by_manager_id = creator_emp.employee_number
        LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
        WHERE em.id = $1
        GROUP BY em.id, creator_emp.id
      `;
      const result = await client.query(query, [matrixId]);
      // The authResult already confirmed matrix existence if not admin, so we use its data.
      // If admin, we re-fetch here with joins.
      if (result.rows.length === 0 && !isAdmin(req.user.roles)) { // Should not happen if auth passed
         res.status(404).json({ message: 'Matrix not found after authorization check.' });
         return;
      }
       res.status(200).json(isAdmin(req.user.roles) ? result.rows[0] : { ...matrixToReturn, criteria: result.rows[0]?.criteria || [] });
      return;

    } else if (method === 'PUT') {
      const authResult = await canUserManageMatrix(client, loggedInUserUpn, req.user.roles, matrixId, token);
      if (!authResult.authorized) {
        res.status(authResult.statusCode || 403).json({ message: authResult.message || 'Not authorized' });
        return;
      }
      const currentMatrix = authResult.matrix;

      const { 
        title, 
        description, 
        valid_from, 
        valid_to, 
        status,
        criteria, // Array of criteria objects
        employee_ids // Array of employee_numbers for applicability
      } = req.body;

      const validationResult = await validateMatrixInput({ title, description, valid_from, valid_to, criteria, employee_ids });
      if (!validationResult.success) {
        console.error("PUT /matrixId validation error:", validationResult.errors);
        res.status(400).json({ message: 'Invalid input', errors: validationResult.errors });
        return;
      }

      // Check if matrix is in a state that allows updates (only draft or if inactivating)
      if (currentMatrix.status !== 'draft' && status !== 'inactive' && status !== undefined && currentMatrix.status !== status) {
         // Allow changing other fields if status is not changing from a non-draft state, unless it's to inactive
        if (currentMatrix.status !== 'inactive' && status !== 'inactive') {
             res.status(400).json({ message: `Can only update 'draft' matrices or set non-draft matrices to 'inactive'. Current status: ${currentMatrix.status}, tried to set to: ${status}` });
             return;
        }
      }


      await client.query('BEGIN');
      const updateQuery = `
        UPDATE evaluation_matrices 
        SET 
          title = $1,
          description = $2,
          valid_from = $3,
          valid_to = $4,
          status = $5,
          updated_by = $6, 
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const updatedMatrixResult = await client.query(updateQuery, [
        title || currentMatrix.title,
        description || currentMatrix.description,
        valid_from || currentMatrix.valid_from,
        valid_to || currentMatrix.valid_to,
        status || currentMatrix.status,
        loggedInUserUpn, // updated_by is UPN
        matrixId
      ]);

      if (criteria && Array.isArray(criteria)) {
        await client.query('DELETE FROM evaluation_criteria WHERE matrix_id = $1', [matrixId]);
        for (const criterion of criteria) {
          await client.query(
            `INSERT INTO evaluation_criteria 
             (matrix_id, name, description, weight, is_competency_gap_critical, 
              min_score_possible, max_score_possible, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [
              matrixId,
              criterion.name,
              criterion.description,
              criterion.weight,
              criterion.is_competency_gap_critical,
              criterion.min_score_possible,
              criterion.max_score_possible,
              loggedInUserUpn // UPN
            ]
          );
        }
      }

      if (employee_ids && Array.isArray(employee_ids)) {
        await client.query('DELETE FROM matrix_applicability WHERE matrix_id = $1', [matrixId]);
        for (const empId of employee_ids) { 
          // Ensure valid_from and valid_to for applicability are from the matrix main dates if not provided for applicability itself
          const applicabilityValidFrom = valid_from || updatedMatrixResult.rows[0].valid_from;
          const applicabilityValidTo = valid_to || updatedMatrixResult.rows[0].valid_to;
          await client.query(
            `INSERT INTO matrix_applicability 
             (matrix_id, employee_id, valid_from, valid_to, status, created_by, updated_by)
             VALUES ($1, $2, $3, $4, 'active', $5, $5)`,
            [matrixId, empId, applicabilityValidFrom, applicabilityValidTo, loggedInUserUpn] // UPN
          );
        }
      }

      await client.query('COMMIT');
      
      // Fetch the complete updated matrix to return
      const finalMatrixQuery = `
        SELECT 
          em.*,
          creator_emp.name as employee_name,
          creator_emp.company_name as company_name,
          creator_emp.employee_number as manager_profile_employee_number,
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
          ) FILTER (WHERE ec.id IS NOT NULL) as criteria
        FROM evaluation_matrices em
        LEFT JOIN employees creator_emp ON em.created_by_manager_id = creator_emp.employee_number
        LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
        WHERE em.id = $1
        GROUP BY em.id, creator_emp.id
      `;
      const finalMatrixResult = await client.query(finalMatrixQuery, [matrixId]);
      res.status(200).json(finalMatrixResult.rows[0]);
      return;

    } else if (method === 'DELETE') {
      const authResult = await canUserManageMatrix(client, loggedInUserUpn, req.user.roles, matrixId, token);
      if (!authResult.authorized) {
        res.status(authResult.statusCode || 403).json({ message: authResult.message || 'Not authorized' });
        return;
      }
      const currentMatrix = authResult.matrix;

      // Check if matrix is already inactive
      if (currentMatrix.status === 'inactive') {
        res.status(400).json({ message: 'Matrix is already inactive.' });
        return;
      }
      
      // Prevent deleting matrices that are in use by evaluations
      const usageCheck = await client.query(
        "SELECT 1 FROM evaluations WHERE matrix_id = $1 LIMIT 1",
        [matrixId]
      );
      if (usageCheck.rows.length > 0) {
        res.status(400).json({ message: "Cannot delete matrix: It is currently associated with one or more evaluations. Please inactivate it instead if you wish to prevent new uses." });
        return;
      }


      await client.query('BEGIN');
      // Instead of actual deletion, set status to 'inactive'
      const result = await client.query(
        "UPDATE evaluation_matrices SET status = 'inactive', updated_by = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [loggedInUserUpn, matrixId] // UPN
      );
      await client.query('COMMIT');
      res.status(200).json({ message: 'Matrix inactivated successfully', matrix: result.rows[0] });
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
    console.error(`Error in /api/evaluation-matrices/${matrixId} API:`, error);
    if (error.code === '23503') { // foreign key violation
        res.status(409).json({ message: 'Conflict: Operation violates data integrity. The matrix might be in use.', details: error.detail });
    } else {
        res.status(500).json({ message: 'Internal Server Error', details: error.message });
    }
    return;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default withAuth(handler); 