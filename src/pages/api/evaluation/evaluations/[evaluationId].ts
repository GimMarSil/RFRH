import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../../middleware/auth';
import { withErrorHandler, ValidationError, NotFoundError, AuthorizationError } from '../../../../lib/errors';
import { executeQuery, executeTransaction } from '../../../../lib/db/pool';
import { z } from 'zod';

// Validation schemas
const evaluationUpdateSchema = z.object({
  status: z.enum(['draft', 'in_progress', 'submitted', 'acknowledged']).optional(),
  manager_overall_comments: z.string().optional(),
  employee_acknowledgement_comments: z.string().optional(),
});

// GET /api/evaluation/evaluations/[evaluationId]
async function getEvaluation(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { evaluationId } = req.query;
  if (!evaluationId || Array.isArray(evaluationId)) {
    throw new ValidationError('Valid evaluation ID must be provided');
  }

  const evaluation = await executeQuery(
    `SELECT 
      e.*,
      em.title as matrix_title,
      em.valid_from as matrix_valid_from,
      em.valid_to as matrix_valid_to,
      CONCAT(u.first_name, ' ', u.last_name) as employee_name,
      CONCAT(ev.first_name, ' ', ev.last_name) as evaluator_name,
      json_agg(
        json_build_object(
          'id', ec.id,
          'name', ec.name,
          'description', ec.description,
          'weight', ec.weight,
          'is_competency_gap_critical', ec.is_competency_gap_critical,
          'min_score_possible', ec.min_score_possible,
          'max_score_possible', ec.max_score_possible,
          'score', ees.achievement_percentage,
          'manager_comments', ees.manager_criterion_comments
        )
      ) as criteria_scores
    FROM evaluations e
    JOIN evaluation_matrices em ON e.matrix_id = em.id
    JOIN users u ON e.employee_id = u.id
    JOIN users ev ON e.evaluator_id = ev.id
    LEFT JOIN evaluation_criteria ec ON em.id = ec.matrix_id
    LEFT JOIN evaluation_criteria_scores ees ON e.id = ees.evaluation_id AND ec.id = ees.criterion_id
    WHERE e.id = $1
    GROUP BY e.id, em.id, u.id, ev.id`,
    [evaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Evaluation');
  }

  // Check access permissions
  const evalData = evaluation[0];
  if (!user.roles.includes('admin')) {
    if (user.roles.includes('manager')) {
      const isManagerOfDepartment = await executeQuery(
        'SELECT 1 FROM department_managers WHERE department_id = $1 AND user_id = $2',
        [evalData.department_id, user.id]
      );
      if (isManagerOfDepartment.length === 0) {
        throw new AuthorizationError('Not authorized to view this evaluation');
      }
    } else if (evalData.employee_id !== user.id) {
      throw new AuthorizationError('Not authorized to view this evaluation');
    }
  }

  res.status(200).json(evalData);
}

// PUT /api/evaluation/evaluations/[evaluationId]
async function updateEvaluation(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { evaluationId } = req.query;
  if (!evaluationId || Array.isArray(evaluationId)) {
    throw new ValidationError('Valid evaluation ID must be provided');
  }

  // Validate input
  const result = evaluationUpdateSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid evaluation data', result.error);
  }

  const { status, manager_overall_comments, employee_acknowledgement_comments } = result.data;

  // Get current evaluation state
  const currentEval = await executeQuery(
    'SELECT status, employee_id, evaluator_id FROM evaluations WHERE id = $1',
    [evaluationId]
  );

  if (currentEval.length === 0) {
    throw new NotFoundError('Evaluation');
  }

  const evaluation = currentEval[0];

  // Check permissions and validate status transition
  if (!user.roles.includes('admin')) {
    if (user.roles.includes('manager')) {
      if (evaluation.evaluator_id !== user.id) {
        throw new AuthorizationError('Not authorized to update this evaluation');
      }
      if (status && !['in_progress', 'submitted'].includes(status)) {
        throw new ValidationError('Invalid status transition for manager');
      }
    } else {
      if (evaluation.employee_id !== user.id) {
        throw new AuthorizationError('Not authorized to update this evaluation');
      }
      if (evaluation.status !== 'submitted') {
        throw new ValidationError('Evaluation must be submitted before acknowledgment');
      }
      if (status || manager_overall_comments) {
        throw new ValidationError('Employee can only update acknowledgment');
      }
    }
  }

  // Update evaluation
  const updatedEvaluation = await executeTransaction(async (client) => {
    const updates: string[] = [];
    const values: any[] = [];
    let valueCount = 1;

    if (status) {
      updates.push(`status = $${valueCount++}`);
      values.push(status);
      if (status === 'submitted') {
        updates.push(`submitted_at = NOW()`);
      } else if (status === 'acknowledged') {
        updates.push(`acknowledged_at = NOW()`);
      }
    }

    if (manager_overall_comments) {
      updates.push(`manager_overall_comments = $${valueCount++}`);
      values.push(manager_overall_comments);
    }

    if (employee_acknowledgement_comments) {
      updates.push(`employee_acknowledgement_comments = $${valueCount++}`);
      values.push(employee_acknowledgement_comments);
    }

    if (updates.length === 0) {
      throw new ValidationError('No updates provided');
    }

    updates.push(`updated_by_user_id = $${valueCount++}`);
    values.push(user.id);
    updates.push(`updated_at = NOW()`);

    values.push(evaluationId);

    const query = `
      UPDATE evaluations 
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
        return getEvaluation(req, res);
      case 'PUT':
        return updateEvaluation(req, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  })
); 