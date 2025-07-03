import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface NotificationConfig {
  evaluationDueDays: number;
  selfEvaluationDueDays: number;
  reminderIntervalDays: number;
}

const config: NotificationConfig = {
  evaluationDueDays: 7,
  selfEvaluationDueDays: 7,
  reminderIntervalDays: 3,
};

export async function checkAndCreateNotifications() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check upcoming evaluation deadlines
    const upcomingEvaluations = await client.query(
      `SELECT 
        ee.id as evaluation_id,
        ee.employee_id,
        ee.evaluator_id,
        em.title as matrix_title,
        em.valid_to
      FROM employee_evaluations ee
      JOIN evaluation_matrices em ON ee.matrix_id = em.id
      WHERE ee.status = 'draft'
      AND em.valid_to <= NOW() + INTERVAL '${config.evaluationDueDays} days'
      AND em.valid_to > NOW()`
    );

    for (const evaluation of upcomingEvaluations.rows) {
      // Notify manager
      await createNotification(
        'evaluation_due',
        evaluation.evaluator_id,
        'Evaluation Due Soon',
        `The evaluation "${evaluation.matrix_title}" for employee ${evaluation.employee_id} is due in ${config.evaluationDueDays} days.`,
        { evaluation_id: evaluation.evaluation_id }
      );

      // Notify employee
      await createNotification(
        'evaluation_due',
        evaluation.employee_id,
        'Evaluation Due Soon',
        `Your evaluation "${evaluation.matrix_title}" is due in ${config.evaluationDueDays} days.`,
        { evaluation_id: evaluation.evaluation_id }
      );
    }

    // Check pending evaluations that need reminders
    const pendingEvaluations = await client.query(
      `SELECT 
        ee.id as evaluation_id,
        ee.employee_id,
        ee.evaluator_id,
        em.title as matrix_title,
        em.valid_to,
        ee.updated_at
      FROM employee_evaluations ee
      JOIN evaluation_matrices em ON ee.matrix_id = em.id
      WHERE ee.status = 'draft'
      AND em.valid_to > NOW()
      AND ee.updated_at <= NOW() - INTERVAL '${config.reminderIntervalDays} days'`
    );

    for (const evaluation of pendingEvaluations.rows) {
      // Notify manager
      await createNotification(
        'evaluation_pending',
        evaluation.evaluator_id,
        'Evaluation Reminder',
        `The evaluation "${evaluation.matrix_title}" for employee ${evaluation.employee_id} is still pending.`,
        { evaluation_id: evaluation.evaluation_id }
      );
    }

    // Check upcoming self-evaluation deadlines
    const upcomingSelfEvaluations = await client.query(
      `SELECT 
        se.id as self_evaluation_id,
        se.employee_id,
        em.title as matrix_title,
        em.valid_to
      FROM self_evaluations se
      JOIN evaluation_matrices em ON se.matrix_id = em.id
      WHERE se.status = 'draft'
      AND em.valid_to <= NOW() + INTERVAL '${config.selfEvaluationDueDays} days'
      AND em.valid_to > NOW()`
    );

    for (const selfEvaluation of upcomingSelfEvaluations.rows) {
      // Notify employee
      await createNotification(
        'self_evaluation_due',
        selfEvaluation.employee_id,
        'Self-Evaluation Due Soon',
        `Your self-evaluation "${selfEvaluation.matrix_title}" is due in ${config.selfEvaluationDueDays} days.`,
        { self_evaluation_id: selfEvaluation.self_evaluation_id }
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createNotification(
  type: string,
  recipientId: string,
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO evaluation_notifications 
       (type, recipient_id, title, message, status, metadata, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
      [type, recipientId, title, message, metadata, 'system']
    );
  } finally {
    client.release();
  }
}

export async function runNotificationChecks() {
  try {
    await checkAndCreateNotifications();
  } catch (error) {
    console.error('Error in notification checks:', error);
    throw error;
  }
} 