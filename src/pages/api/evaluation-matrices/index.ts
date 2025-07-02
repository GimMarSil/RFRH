import { Pool } from 'pg';
import { NextApiRequest, NextApiResponse } from 'next';
import { getAllActiveEmployees, getEmployeeDetailsByUserId, getEmployeeDetailsByNumber } from '../../../lib/employeeDbService';
import { withAuth, AuthenticatedRequest, isAdmin, isManager, getUserDirectReports } from '../../../middleware/auth';
import { validateMatrixInput } from '../../../lib/evaluation/validation';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Helper to set user ID for logging (if available)
async function setUserForSession(client, userId) {
  if (userId) {
    await client.query(`SET app.current_user_id = '${userId}';`);
  } else {
    // Clear it if no user is provided to avoid using stale ID from pooled connection
    await client.query("SET app.current_user_id = '';");
  }
}

// Exemplo de body esperado para o frontend:
// {
//   "title": "Matriz 2024",
//   "description": "Avaliação anual",
//   "valid_from": "2024-01-01",
//   "valid_to": "2024-12-31",
//   "criteria": [
//     { "name": "Critério 1", "description": "...", "weight": 50, "is_cutting": false },
//     { "name": "Critério 2", "description": "...", "weight": 50, "is_cutting": false }
//   ],
//   "employee_ids": ["123", "456", "789"]
// }

async function getAuthenticatedSystemUserId(req: NextApiRequest): Promise<string | null> {
  // TODO: Replace with actual MSAL or equivalent authentication logic
  console.warn('Using placeholder system user ID for audit logs in evaluation matrices API. Integrate actual authentication.');
  return 'system-placeholder-user-id';
}

async function getSelectedEmployeeId(req: NextApiRequest): Promise<string | null> {
  const selectedEmployeeId = req.headers['x-selected-employee-id'] as string;
  if (!selectedEmployeeId) {
    console.warn('X-Selected-Employee-ID header not found for evaluation matrices API.');
    return null;
  }
  return selectedEmployeeId;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse): Promise<void> {
  const { method } = req;

  const client = await pool.connect();
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: 'Authentication required, user ID missing.' });
      return;
    }

    const actingManagerUhpn = req.user.id; // UPN of the logged-in user creating the matrix

    if (method === 'GET') {
      const sqlQueryBase = `
        SELECT
          em.id as matrix_id,
          em.title,
          em.description,
          em.valid_from,
          em.valid_to,
          em.status,
          em.created_at,
          em.updated_at,
          em.created_by_manager_id, -- This is manager's employee_number
          creator.name as employee_name,
          creator.company_name as company_name,
          creator.employee_number as manager_profile_employee_number, -- manager's own employee_number from employees table
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
        LEFT JOIN employees creator ON em.created_by_manager_id = creator.employee_number -- JOIN ON employee_number
        LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
      `;
      const sqlOrderBy = `
        ORDER BY em.created_at DESC
      `;
      
      let sqlQuery: string;
      let finalParams: any[];

      if (isAdmin(req.user.roles)) {
        sqlQuery = `
          ${sqlQueryBase}
          -- Admin sees all, no specific WHERE clause needed beyond $1 for structure
          WHERE $1 
          GROUP BY em.id, creator.employee_number
          ${sqlOrderBy}
        `;
        finalParams = [true, null]; // $1=isAdmin (true), $2 not used for admin
      } else {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: 'Authorization token is missing or invalid for Graph API call.' });
        }
        const token = authHeader.split(' ')[1];

        try {
          const directReportsData = await getUserDirectReports(token); // Gets reports for the logged-in user (actingManagerUhpn)
          const subordinateUpns = directReportsData
            .map(report => report.userPrincipalName)
            .filter(upn => typeof upn === 'string' && upn.length > 0);

          // A manager can see matrices created by themselves or by their direct reports.
          const allowedCreatorUpns = [actingManagerUhpn, ...subordinateUpns];
          
          sqlQuery = `
            ${sqlQueryBase}
            WHERE NOT $1 AND creator.user_id = ANY($2::TEXT[]) -- Filter: creator's UPN must be in the allowed list
            GROUP BY em.id, creator.employee_number
            ${sqlOrderBy}
          `;
          finalParams = [false, allowedCreatorUpns]; // $1=isAdmin (false), $2=array of allowed UPNs

        } catch (graphError) {
          console.error('Failed to fetch direct reports from Graph API:', graphError);
          return res.status(500).json({ message: 'Failed to retrieve subordinate data for matrix filtering.', details: graphError.message });
        }
      }
      const result = await client.query(sqlQuery, finalParams);
      res.status(200).json(result.rows);
      return;

    } else if (method === 'POST') {
      const selectedEmployeeIdHeader = req.headers['x-selected-employee-id'] as string;
      if (!selectedEmployeeIdHeader) {
        return res.status(400).json({ message: 'x-selected-employee-id header is required (acting manager employee_number).' });
      }

      // Get the UPN of the employee profile the user is acting as (from the x-selected-employee-id header)
      const actingManagerProfile = await client.query('SELECT user_id FROM employees WHERE employee_number = $1', [selectedEmployeeIdHeader]);
      if (actingManagerProfile.rows.length === 0 || !actingManagerProfile.rows[0].user_id) {
        return res.status(400).json({ message: `Could not find UPN for the acting manager profile (employee_number: ${selectedEmployeeIdHeader}).` });
      }
      const actingManagerProfileUpn = actingManagerProfile.rows[0].user_id;

      // Ensure the logged-in user (actingManagerUhpn) matches the UPN of the selected employee profile they are trying to act as
      if (actingManagerUhpn !== actingManagerProfileUpn) {
        return res.status(403).json({ message: 'Authenticated user UPN does not match the UPN of the selected employee profile.' });
      }

      const { 
        title, 
        description, 
        valid_from, 
        valid_to, 
        status = 'draft',
        criteria,
        employee_ids // These are subordinate employee_numbers
      } = req.body;

      const validationResult = await validateMatrixInput(req.body);
      if (!validationResult.success) {
        console.error('[API POST Matrix] Input validation failed:', validationResult.errors);
        return res.status(400).json({ message: 'Invalid input', errors: validationResult.errors });
      }

      if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ message: 'employee_ids is required and must be an array with at least one employee ID.' });
      }
      
      // Authorization: Check if the actingManagerProfileUpn is the manager of all requested subordinate employee_ids
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is missing or invalid for Graph API call (POST).' });
      }
      const token = authHeader.split(' ')[1];
      let authorizedSubordinateEmployeeNumbers: string[] = [];

      try {
        // Get UPNs of direct reports to the actingManagerProfileUpn (who is the logged-in user)
        const directReportsData = await getUserDirectReports(token, actingManagerProfileUpn); // Pass actingManagerProfileUpn to get *their* reports
        const subordinateUpns = directReportsData
          .map(report => report.userPrincipalName)
          .filter(upn => typeof upn === 'string' && upn.length > 0);

        if (subordinateUpns.length > 0) {
          const subordinatesQuery = await client.query(
            `SELECT employee_number FROM employees WHERE user_id = ANY($1::TEXT[]) AND active = true`,
            [subordinateUpns]
          );
          authorizedSubordinateEmployeeNumbers = subordinatesQuery.rows.map(r => r.employee_number.toString());
        }
        console.log(`[POST Matrix Auth] Acting manager UPN: ${actingManagerProfileUpn} has authorized subordinate employee_numbers:`, authorizedSubordinateEmployeeNumbers);
      } catch (graphError) {
        console.error('[POST Matrix Auth] Failed to fetch direct reports from Graph API:', graphError);
        return res.status(500).json({ message: 'Failed to retrieve subordinate data for authorization.', details: graphError.message });
      }

      const requestedSubordinateIds: string[] = employee_ids.map(String);
      const unauthorizedRequestedIds = requestedSubordinateIds.filter(id => !authorizedSubordinateEmployeeNumbers.includes(id));

      if (unauthorizedRequestedIds.length > 0) {
        console.log(`[POST Matrix Auth] Unauthorized subordinate IDs requested:`, unauthorizedRequestedIds);
        return res.status(403).json({ 
          message: `User (${actingManagerProfileUpn}) is not authorized for some requested subordinate employee IDs.`,
          unauthorized_ids: unauthorizedRequestedIds 
        });
      }
      console.log(`[POST Matrix Auth] All requested subordinate employee_ids are authorized for manager ${actingManagerProfileUpn}.`);

      // If we reach here, authorization passed.
      await client.query('BEGIN');
      
      // created_by_manager_id should be the employee_number of the acting manager (selectedEmployeeIdHeader)
      // created_by and updated_by should be the UPN (actingManagerProfileUpn)
      const matrixResult = await client.query(
        `INSERT INTO evaluation_matrices 
         (title, description, valid_from, valid_to, status, created_by_manager_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING *`,
        [title, description, valid_from, valid_to, status, selectedEmployeeIdHeader, actingManagerProfileUpn]
      );
      const matrix = matrixResult.rows[0];

      if (criteria && Array.isArray(criteria)) {
        for (const criterion of criteria) {
          await client.query(
            `INSERT INTO evaluation_criteria 
             (matrix_id, name, description, weight, is_competency_gap_critical, 
              min_score_possible, max_score_possible, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [matrix.id, criterion.name, criterion.description, criterion.weight, criterion.is_competency_gap_critical, criterion.min_score_possible, criterion.max_score_possible, actingManagerProfileUpn]
          );
        }
      }

      if (employee_ids && Array.isArray(employee_ids)) {
        for (const empId of employee_ids) { 
          await client.query(
            `INSERT INTO matrix_applicability 
             (matrix_id, employee_id, valid_from, valid_to, status, created_by, updated_by)
             VALUES ($1, $2, $3, $4, 'active', $5, $5)`,
            [matrix.id, empId, valid_from, valid_to, actingManagerProfileUpn]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch the complete matrix with criteria
      const completeMatrixQuery = `
        SELECT
          em.id as matrix_id,
          em.title,
          em.description,
          em.valid_from,
          em.valid_to,
          em.status,
          em.created_at,
          em.updated_at,
          em.created_by_manager_id,
          creator.name as employee_name,
          creator.company_name as company_name,
          creator.employee_number as employee_number,
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
        LEFT JOIN employees creator ON em.created_by_manager_id = creator.employee_number -- Corrected JOIN
        LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
        WHERE em.id = $1
        GROUP BY em.id, creator.employee_number -- Corrected GROUP BY
      `;
      const completeMatrix = await client.query(completeMatrixQuery, [matrix.id]);

      res.status(201).json(completeMatrix.rows[0] || null); // Ensure sending null if not found
      return;

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed for this route.`);
      return;
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error in matrices API:', error);
    // Check for specific error types if needed, e.g., error.code for pg errors
    if (error.code === '23505') { // Unique violation
        res.status(409).json({ message: 'Conflict: A similar record already exists.', details: error.detail });
    } else if (error.message.includes('value too long')) {
        res.status(400).json({ message: 'Bad Request: One of the provided values is too long.'});
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