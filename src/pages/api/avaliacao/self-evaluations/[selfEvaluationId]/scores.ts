import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../../../middleware/auth';
import { withErrorHandler, ValidationError, NotFoundError, AuthorizationError } from '../../../../../lib/errors';
import { executeQuery, executeTransaction } from '../../../../../lib/db/pool';
import { z } from 'zod';

// Validation schemas
const scoreInputSchema = z.object({
  criterionId: z.string().uuid(),
  achievementPercentage: z.number().min(0).max(100),
  employeeCriterionComments: z.string().optional(),
});

const scoresSchema = z.array(scoreInputSchema);

// Application-level calculation of scores and total
async function calculateAndPrepareSelfScores(
  selfEvaluationId: string,
  matrixId: string,
  scoreInputs: z.infer<typeof scoresSchema>,
  userId: string
) {
  let overallTotalWeightedScore = 0;
  let hasCriticalZero = false;
  const preparedScores: any[] = [];

  const criteriaDetails = await executeQuery(
    'SELECT id, weight, is_competency_gap_critical FROM evaluation_criteria WHERE matrix_id = $1',
    [matrixId]
  );

  const criteriaDetailsMap = new Map(criteriaDetails.map(c => [c.id, c]));

  for (const input of scoreInputs) {
    const criterionDetail = criteriaDetailsMap.get(input.criterionId);
    if (!criterionDetail) {
      throw new ValidationError(`Criterion with id ${input.criterionId} not found in matrix ${matrixId}`);
    }

    if (criterionDetail.is_competency_gap_critical && input.achievementPercentage === 0) {
      hasCriticalZero = true;
    }

    const normalizedScore = input.achievementPercentage / 100.0;
    const criterionWeight = parseFloat(criterionDetail.weight);
    const finalWeightedScore = normalizedScore * criterionWeight;

    preparedScores.push({
      self_evaluation_id: selfEvaluationId,
      criterion_id: input.criterionId,
      achievement_percentage: input.achievementPercentage,
      criterion_weight_at_evaluation: criterionWeight,
      normalized_score: normalizedScore,
      final_weighted_score: finalWeightedScore,
      employee_criterion_comments: input.employeeCriterionComments,
      created_by_user_id: userId,
      updated_by_user_id: userId
    });
    
    if (!hasCriticalZero) {
      overallTotalWeightedScore += finalWeightedScore;
    }
  }

  if (hasCriticalZero) {
    overallTotalWeightedScore = 0;
  }
  overallTotalWeightedScore = Math.max(0, Math.min(100, parseFloat(overallTotalWeightedScore.toFixed(2))));

  return { preparedScores, overallTotalWeightedScore };
}

// GET /api/evaluation/self-evaluations/[selfEvaluationId]/scores
async function getScores(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { selfEvaluationId } = req.query;
  if (!selfEvaluationId || Array.isArray(selfEvaluationId)) {
    throw new ValidationError('Valid self-evaluation ID must be provided');
  }

  const scores = await executeQuery(
    `SELECT 
      ses.*,
      ec.name as criterion_name,
      ec.description as criterion_description,
      ec.weight as criterion_weight,
      ec.is_competency_gap_critical,
      ec.min_score_possible,
      ec.max_score_possible
    FROM self_evaluation_scores ses
    JOIN evaluation_criteria ec ON ses.criterion_id = ec.id
    WHERE ses.self_evaluation_id = $1
    ORDER BY ec.name`,
    [selfEvaluationId]
  );

  // Check if self-evaluation exists and user has access
  const evaluation = await executeQuery(
    'SELECT employee_id FROM self_evaluations WHERE id = $1',
    [selfEvaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Self-evaluation');
  }

  const evalData = evaluation[0];

  // Check permissions
  if (!user.roles.includes('admin') && evalData.employee_id !== user.id) {
    throw new AuthorizationError('Not authorized to view these scores');
  }

  res.status(200).json(scores);
}

// POST /api/evaluation/self-evaluations/[selfEvaluationId]/scores
async function updateScores(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { selfEvaluationId } = req.query;
  if (!selfEvaluationId || Array.isArray(selfEvaluationId)) {
    throw new ValidationError('Valid self-evaluation ID must be provided');
  }

  // Validate input
  const result = scoresSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid scores data', result.error);
  }

  const evaluation = await executeQuery(
    'SELECT matrix_id, employee_id, status FROM self_evaluations WHERE id = $1',
    [selfEvaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Self-evaluation');
  }

  const evalData = evaluation[0];

  // Check permissions
  if (!user.roles.includes('admin') && evalData.employee_id !== user.id) {
    throw new AuthorizationError('Not authorized to update these scores');
  }

  // Check if self-evaluation is in a state that allows score submission
  if (evalData.status === 'submitted' && !user.roles.includes('admin')) {
    throw new ValidationError('Cannot update scores after submission');
  }

  const { preparedScores, overallTotalWeightedScore } = await calculateAndPrepareSelfScores(
    selfEvaluationId,
    evalData.matrix_id,
    result.data,
    user.id
  );

  const updatedEvaluation = await executeTransaction(async (client) => {
    // Delete existing scores
    await client.query('DELETE FROM self_evaluation_scores WHERE self_evaluation_id = $1', [selfEvaluationId]);

    // Insert new scores
    for (const score of preparedScores) {
      await client.query(
        `INSERT INTO self_evaluation_scores 
         (self_evaluation_id, criterion_id, achievement_percentage, criterion_weight_at_evaluation,
          normalized_score, final_weighted_score, employee_criterion_comments,
          created_by_user_id, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          score.self_evaluation_id,
          score.criterion_id,
          score.achievement_percentage,
          score.criterion_weight_at_evaluation,
          score.normalized_score,
          score.final_weighted_score,
          score.employee_criterion_comments,
          score.created_by_user_id,
          score.updated_by_user_id
        ]
      );
    }

    // Update the total weighted score on the parent self-evaluation
    const result = await client.query(
      `UPDATE self_evaluations 
       SET total_weighted_score = $1, 
           updated_by_user_id = $2, 
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [overallTotalWeightedScore, user.id, selfEvaluationId]
    );

    return result.rows[0];
  });

  res.status(200).json({
    message: 'Self-evaluation scores submitted successfully',
    selfEvaluationId,
    totalWeightedScore: overallTotalWeightedScore,
    scores: preparedScores,
    evaluation: updatedEvaluation
  });
}

// Export handlers with middleware
export default withErrorHandler(
  withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    switch (req.method) {
      case 'GET':
        return getScores(req, res);
      case 'POST':
        return updateScores(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  })
); 