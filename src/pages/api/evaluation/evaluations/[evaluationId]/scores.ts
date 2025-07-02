import { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../../../middleware/auth';
import { withErrorHandler, ValidationError, NotFoundError, AuthorizationError } from '../../../../../lib/errors';
import { executeQuery, executeTransaction } from '../../../../../lib/db/pool';
import { z } from 'zod';

// Validation schemas
const scoreInputSchema = z.object({
  criterionId: z.string().uuid(),
  achievementPercentage: z.number().min(0).max(100),
  managerCriterionComments: z.string().optional(),
});

const scoresSchema = z.array(scoreInputSchema);

// Application-level calculation of scores and total
async function calculateAndPrepareScores(
  evaluationId: string,
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
      evaluation_id: evaluationId,
      criterion_id: input.criterionId,
      achievement_percentage: input.achievementPercentage,
      criterion_weight_at_evaluation: criterionWeight,
      normalized_score: normalizedScore,
      final_weighted_score: finalWeightedScore,
      manager_criterion_comments: input.managerCriterionComments,
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

// GET /api/evaluation/evaluations/[evaluationId]/scores
async function getScores(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { evaluationId } = req.query;
  if (!evaluationId || Array.isArray(evaluationId)) {
    throw new ValidationError('Valid evaluation ID must be provided');
  }

  const scores = await executeQuery(
    `SELECT 
      ees.*,
      ec.name as criterion_name,
      ec.description as criterion_description,
      ec.weight as criterion_weight,
      ec.is_competency_gap_critical,
      ec.min_score_possible,
      ec.max_score_possible
    FROM evaluation_criteria_scores ees
    JOIN evaluation_criteria ec ON ees.criterion_id = ec.id
    WHERE ees.evaluation_id = $1
    ORDER BY ec.name`,
    [evaluationId]
  );

  // Check if evaluation exists and user has access
  const evaluation = await executeQuery(
    'SELECT employee_id, evaluator_id FROM evaluations WHERE id = $1',
    [evaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Evaluation');
  }

  const evalData = evaluation[0];

  // Check permissions
  if (!user.roles.includes('admin')) {
    if (user.roles.includes('manager')) {
      if (evalData.evaluator_id !== user.id) {
        throw new AuthorizationError('Not authorized to view these scores');
      }
    } else if (evalData.employee_id !== user.id) {
      throw new AuthorizationError('Not authorized to view these scores');
    }
  }

  res.status(200).json(scores);
}

// POST /api/evaluation/evaluations/[evaluationId]/scores
async function updateScores(req: AuthenticatedRequest, res: NextApiResponse) {
  const { user } = req;
  if (!user) throw new Error('User not authenticated');

  const { evaluationId } = req.query;
  if (!evaluationId || Array.isArray(evaluationId)) {
    throw new ValidationError('Valid evaluation ID must be provided');
  }

  // Validate input
  const result = scoresSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Invalid scores data', result.error);
  }

  const evaluation = await executeQuery(
    'SELECT matrix_id, evaluator_id, employee_id, status FROM evaluations WHERE id = $1',
    [evaluationId]
  );

  if (evaluation.length === 0) {
    throw new NotFoundError('Evaluation');
  }

  const evalData = evaluation[0];

  // Check permissions
  if (!user.roles.includes('admin')) {
    if (user.roles.includes('manager')) {
      if (evalData.evaluator_id !== user.id) {
        throw new AuthorizationError('Not authorized to update these scores');
      }
    } else {
      throw new AuthorizationError('Only managers can update evaluation scores');
    }
  }

  // Check if evaluation is in a state that allows score submission
  if (!['draft', 'in_progress'].includes(evalData.status)) {
    throw new ValidationError(`Cannot submit scores for evaluation in ${evalData.status} status`);
  }

  const { preparedScores, overallTotalWeightedScore } = await calculateAndPrepareScores(
    evaluationId,
    evalData.matrix_id,
    result.data,
    user.id
  );

  const updatedEvaluation = await executeTransaction(async (client) => {
    // Delete existing scores
    await client.query('DELETE FROM evaluation_criteria_scores WHERE evaluation_id = $1', [evaluationId]);

    // Insert new scores
    for (const score of preparedScores) {
      await client.query(
        `INSERT INTO evaluation_criteria_scores 
         (evaluation_id, criterion_id, achievement_percentage, criterion_weight_at_evaluation,
          normalized_score, final_weighted_score, manager_criterion_comments,
          created_by_user_id, updated_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          score.evaluation_id,
          score.criterion_id,
          score.achievement_percentage,
          score.criterion_weight_at_evaluation,
          score.normalized_score,
          score.final_weighted_score,
          score.manager_criterion_comments,
          score.created_by_user_id,
          score.updated_by_user_id
        ]
      );
    }

    // Update the total weighted score on the parent evaluation
    const result = await client.query(
      `UPDATE evaluations 
       SET total_weighted_score = $1, 
           updated_by_user_id = $2, 
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [overallTotalWeightedScore, user.id, evaluationId]
    );

    return result.rows[0];
  });

  res.status(200).json({
    message: 'Evaluation scores submitted successfully',
    evaluationId,
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