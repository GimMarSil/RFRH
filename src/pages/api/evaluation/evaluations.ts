import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { withErrorHandler, ValidationError, NotFoundError, AuthorizationError } from '../../../lib/errors';
import { executeQuery, executeTransaction } from '../../../lib/db/pool';
import { z } from 'zod';
import { getEmployeeDetailsByNumber } from '../../../lib/employeeDbService';

// Validation schemas
const evaluationSchema = z.object({
  employeeId: z.string().uuid(),
  matrixId: z.string().uuid(),
  evaluatorId: z.string().uuid(),
  status: z.enum(['draft', 'in_progress', 'completed']),
  criteria: z.array(z.object({
    id: z.string().uuid(),
    score: z.number().min(1).max(5),
    comments: z.string().optional(),
  })),
});

// Helper to check if user can access evaluation
async function canAccessEvaluation(
  evaluationId: string,
  userId: string,
  roles: string[]
): Promise<boolean> {
  const evaluation = await executeQuery(
    `SELECT e.*, m.department_id 
     FROM evaluations e
     JOIN evaluation_matrices m ON e.matrix_id = m.id
     WHERE e.id = $1`,
    [evaluationId]
  );

  if (evaluation.length === 0) {
    return false;
  }

  const eval = evaluation[0];
  
  // Admins can access all evaluations
  if (roles.includes('admin')) {
    return true;
  }

  // Managers can access evaluations in their department
  if (roles.includes('manager')) {
    const isManagerOfDepartment = await executeQuery(
      'SELECT 1 FROM department_managers WHERE department_id = $1 AND user_id = $2',
      [eval.department_id, userId]
    );
    return isManagerOfDepartment.length > 0;
  }

  // Users can access their own evaluations
  return eval.employee_id === userId;
}

// GET /api/evaluation/evaluations
async function getEvaluations(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const evaluations = await executeQuery(
    `SELECT e.*, 
            em.name as matrix_name,
            CONCAT(u.first_name, ' ', u.last_name) as employee_name,
            CONCAT(ev.first_name, ' ', ev.last_name) as evaluator_name
     FROM evaluations e
     JOIN evaluation_matrices em ON e.matrix_id = em.id
     JOIN users u ON e.employee_id = u.id
     JOIN users ev ON e.evaluator_id = ev.id
     WHERE e.employee_id = $1
     ORDER BY e.created_at DESC`,
    [user.id]
  );

  res.status(200).json(evaluations);
}

// POST /api/evaluation/evaluations
async function createEvaluation(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  // Validate input
  const result = evaluationSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid evaluation data', result.error);
  }

  const { employeeId, matrixId, evaluatorId, status, criteria } = result.data;

  // Validação obrigatória no SQL Server
  const employee = await getEmployeeDetailsByNumber(employeeId);
  if (!employee) {
    return res.status(422).json({ error: 'Funcionário não existe ou está inativo no sistema principal.' });
  }

  // Verify matrix exists and is active
  const matrix = await executeQuery(
    'SELECT * FROM evaluation_matrices WHERE id = $1 AND is_active = true',
    [matrixId]
  );

  if (matrix.length === 0) {
    throw new NotFoundError('Evaluation matrix');
  }

  // Verify evaluator exists and has appropriate role
  const evaluator = await executeQuery(
    'SELECT roles FROM users WHERE id = $1',
    [evaluatorId]
  );

  if (evaluator.length === 0) {
    throw new NotFoundError('Evaluator');
  }

  if (!evaluator[0].roles.includes('manager') && !evaluator[0].roles.includes('admin')) {
    throw new AuthorizationError('Evaluator must be a manager or admin');
  }

  // Create evaluation in transaction
  const evaluation = await executeTransaction(async (client) => {
    // Insert evaluation
    const evaluationResult = await client.query(
      `INSERT INTO evaluations 
       (employee_id, matrix_id, evaluator_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [employeeId, matrixId, evaluatorId, status]
    );

    // Insert criteria scores
    for (const criterion of criteria) {
      await client.query(
        `INSERT INTO evaluation_criteria_scores
         (evaluation_id, criterion_id, score, comments)
         VALUES ($1, $2, $3, $4)`,
        [evaluationResult.rows[0].id, criterion.id, criterion.score, criterion.comments]
      );
    }

    return evaluationResult.rows[0];
  });

  res.status(201).json(evaluation);
}

// Export handlers with middleware
export default withErrorHandler(
  withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    switch (req.method) {
      case 'GET':
        return getEvaluations(req, res);
      case 'POST':
        return createEvaluation(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  })
); 