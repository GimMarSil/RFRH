import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../../middleware/auth';
import { withErrorHandler, ValidationError, NotFoundError, AuthorizationError } from '../../../../lib/errors';
import { executeQuery, executeTransaction } from '../../../../lib/db/pool';
import { z } from 'zod';

// Validation schemas
const selfEvaluationUpdateSchema = z.object({
  status: z.enum(['draft', 'in_progress', 'submitted']).optional(),
  employeeOverallComments: z.string().optional(),
  totalWeightedScore: z.number().min(0).max(100).optional(),
});

// GET /api/evaluation/self-evaluations/[selfEvaluationId]
async function getSelfEvaluation(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { selfEvaluationId } = req.query;
  if (!selfEvaluationId || Array.isArray(selfEvaluationId)) {
    throw new ValidationError('Valid self-evaluation ID must be provided');
  }

  const evaluation = await executeQuery(
    `SELECT 
      se.*,
      em.title as matrix_title,
      em.valid_from as matrix_valid_from,
      em.valid_to as matrix_valid_to,
      CONCAT(u.first_name, ' ', u.last_name) as employee_name,
      json_agg(
        json_build_object(
          'id', ec.id,
          'name', ec.name,
          'description', ec.description,
          'weight', ec.weight,
          'is_competency_gap_critical', ec.is_competency_gap_critical,
          'min_score_possible', ec.min_score_possible,
          'max_score_possible', ec.max_score_possible,
          'score', ses.achievement_percentage,
          'employee_comments', ses.employee_criterion_comments
        )
      ) as criteria_scores
    FROM self_evaluations se
    JOIN evaluation_matrices em ON se.matrix_id = em.id
    JOIN users u ON se.employee_id = u.id
    LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
    LEFT JOIN self_evaluation_scores ses ON se.id = ses.self_evaluation_id AND ec.id = ses.criterion_id
    WHERE se.id = $1
    GROUP BY se.id, em.id, u.id`,
    [selfEvaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Self-evaluation');
  }

  const evalData = evaluation[0];

  // Check access permissions
  if (!user.roles.includes('admin') && evalData.employee_id !== user.id) {
    throw new AuthorizationError('Not authorized to view this self-evaluation');
  }

  res.status(200).json(evalData);
}

// PUT /api/evaluation/self-evaluations/[selfEvaluationId]
async function updateSelfEvaluation(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { selfEvaluationId } = req.query;
  if (!selfEvaluationId || Array.isArray(selfEvaluationId)) {
    throw new ValidationError('Valid self-evaluation ID must be provided');
  }

  // Validate input
  const result = selfEvaluationUpdateSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid self-evaluation data', result.error);
  }

  const { status, employeeOverallComments, totalWeightedScore } = result.data;

  // Get current evaluation state
  const currentEval = await executeQuery(
    'SELECT status, employee_id FROM self_evaluations WHERE id = $1',
    [selfEvaluationId]
  );

  if (currentEval.length === 0) {
    throw new NotFoundError('Self-evaluation');
  }

  const evaluation = currentEval[0];

  // Check permissions
  if (!user.roles.includes('admin') && evaluation.employee_id !== user.id) {
    throw new AuthorizationError('Not authorized to update this self-evaluation');
  }

  // Validate status transition
  if (status && evaluation.status === 'submitted' && !user.roles.includes('admin')) {
    throw new ValidationError('Cannot update submitted self-evaluation');
  }

  // Update self-evaluation
  const updatedEvaluation = await executeTransaction(async (client) => {
    const updates: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    if (status) {
      updates.push(`status = $${valueCount++}`);
      values.push(status);
      if (status === 'submitted') {
        updates.push(`submitted_at = NOW()`);
      }
    }

    if (employeeOverallComments) {
      updates.push(`employee_overall_comments = $${valueCount++}`);
      values.push(employeeOverallComments);
    }

    if (totalWeightedScore !== undefined) {
      updates.push(`total_weighted_score = $${valueCount++}`);
      values.push(totalWeightedScore);
    }

    if (updates.length === 0) {
      throw new ValidationError('No updates provided');
    }

    updates.push(`updated_by_user_id = $${valueCount++}`);
    values.push(user.id);
    updates.push(`updated_at = NOW()`);

    values.push(selfEvaluationId);

    const query = `
      UPDATE self_evaluations 
      SET ${updates.join(', ')}
      WHERE id = $${valueCount}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows[0];
  });

  res.status(200).json(updatedEvaluation);
}

// Export handlers with middleware
export default withErrorHandler(
  withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    switch (req.method) {
      case 'GET':
        return getSelfEvaluation(req, res);
      case 'PUT':
        return updateSelfEvaluation(req, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  })
); 