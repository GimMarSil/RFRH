import { Pool } from 'pg';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('Starting table creation...');
  console.log('Database URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');

  const client = await pgPool.connect();
  try {
    console.log('Connected to database successfully');
    await client.query('BEGIN');

    // Create employees table first
    console.log('Creating employees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company_name TEXT,
        department TEXT,
        user_id TEXT,
        active BOOLEAN DEFAULT true,
        admission_date DATE,
        termination_date DATE,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `);
    console.log('Employees table created successfully');

    // Create evaluation matrices table
    console.log('Creating evaluation matrices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_matrices (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        valid_from DATE NOT NULL,
        valid_to DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_date_range CHECK (valid_from <= valid_to)
      );
    `);
    console.log('Evaluation matrices table created successfully');

    // Create evaluation criteria table
    console.log('Creating evaluation criteria table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_criteria (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
        is_competency_gap_critical BOOLEAN DEFAULT false,
        min_score_possible INTEGER DEFAULT 0,
        max_score_possible INTEGER DEFAULT 100,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_name_per_matrix UNIQUE (matrix_id, name),
        CONSTRAINT valid_score_range CHECK (min_score_possible >= 0 AND max_score_possible <= 100 AND min_score_possible <= max_score_possible)
      );
    `);
    console.log('Evaluation criteria table created successfully');

    // Create employee evaluations table
    console.log('Creating employee evaluations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_evaluations (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
        employee_id TEXT NOT NULL REFERENCES employees(id),
        manager_id TEXT NOT NULL REFERENCES employees(id),
        evaluation_period_month DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'validated', 'cancelled')),
        total_weighted_score DECIMAL(5,2),
        manager_overall_comments TEXT,
        employee_acknowledgement_comments TEXT,
        cancellation_reason TEXT,
        validated_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancelled_by_user_id TEXT,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
      );
    `);
    console.log('Employee evaluations table created successfully');

    // Create employee evaluation scores table
    console.log('Creating employee evaluation scores table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_evaluation_scores (
        id SERIAL PRIMARY KEY,
        evaluation_id INTEGER NOT NULL REFERENCES employee_evaluations(id) ON DELETE CASCADE,
        criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id),
        achievement_percentage DECIMAL(5,2) NOT NULL CHECK (achievement_percentage >= 0 AND achievement_percentage <= 100),
        criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
        normalized_score DECIMAL(5,2) NOT NULL,
        final_weighted_score DECIMAL(5,2) NOT NULL,
        manager_criterion_comments TEXT,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_per_evaluation UNIQUE (evaluation_id, criterion_id)
      );
    `);
    console.log('Employee evaluation scores table created successfully');

    // Create self evaluations table
    console.log('Creating self evaluations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS self_evaluations (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
        employee_id TEXT NOT NULL REFERENCES employees(id),
        evaluation_period_month DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
        total_weighted_score DECIMAL(5,2),
        employee_overall_comments TEXT,
        submitted_at TIMESTAMPTZ,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_self_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
      );
    `);
    console.log('Self evaluations table created successfully');

    // Create self evaluation scores table
    console.log('Creating self evaluation scores table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS self_evaluation_scores (
        id SERIAL PRIMARY KEY,
        self_evaluation_id INTEGER NOT NULL REFERENCES self_evaluations(id) ON DELETE CASCADE,
        criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id),
        achievement_percentage DECIMAL(5,2) NOT NULL CHECK (achievement_percentage >= 0 AND achievement_percentage <= 100),
        criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
        normalized_score DECIMAL(5,2) NOT NULL,
        final_weighted_score DECIMAL(5,2) NOT NULL,
        employee_criterion_comments TEXT,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_per_self_evaluation UNIQUE (self_evaluation_id, criterion_id)
      );
    `);
    console.log('Self evaluation scores table created successfully');

    // Create evaluation matrix applicability table
    console.log('Creating evaluation matrix applicability table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_matrix_applicability (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        employee_id TEXT NOT NULL REFERENCES employees(id),
        valid_from DATE NOT NULL,
        valid_to DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        inactivated_at TIMESTAMPTZ,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_date_range CHECK (valid_from <= valid_to)
      );
    `);

    // Create partial unique index for active matrices
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_matrix_per_employee 
      ON evaluation_matrix_applicability (employee_id, matrix_id) 
      WHERE status = 'active';
    `);
    console.log('Evaluation matrix applicability table created successfully');

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_evaluation_matrices_status ON evaluation_matrices(status);
      CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_matrix_id ON evaluation_criteria(matrix_id);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluations_matrix_id ON employee_evaluations(matrix_id);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluations_employee_id ON employee_evaluations(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluations_manager_id ON employee_evaluations(manager_id);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluations_status ON employee_evaluations(status);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluation_scores_evaluation_id ON employee_evaluation_scores(evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_employee_evaluation_scores_criterion_id ON employee_evaluation_scores(criterion_id);
      CREATE INDEX IF NOT EXISTS idx_self_evaluations_matrix_id ON self_evaluations(matrix_id);
      CREATE INDEX IF NOT EXISTS idx_self_evaluations_employee_id ON self_evaluations(employee_id);
      CREATE INDEX IF NOT EXISTS idx_self_evaluations_status ON self_evaluations(status);
      CREATE INDEX IF NOT EXISTS idx_self_evaluation_scores_self_evaluation_id ON self_evaluation_scores(self_evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_self_evaluation_scores_criterion_id ON self_evaluation_scores(criterion_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_matrix_id ON evaluation_matrix_applicability(matrix_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_employee_id ON evaluation_matrix_applicability(employee_id);
      CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_status ON evaluation_matrix_applicability(status);
    `);
    console.log('Indexes created successfully');

    await client.query('COMMIT');
    console.log('All tables and indexes created successfully');
    res.status(200).json({ message: 'Tables created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Error creating tables',
      error: error.message,
      details: error.stack,
      code: error.code,
      hint: error.hint
    });
  } finally {
    client.release();
  }
} 