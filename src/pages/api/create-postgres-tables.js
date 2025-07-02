require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Configuração Postgres (Railway)
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    console.log('Connecting to Railway Postgres...');
    await pgClient.connect();
    console.log('Connected to Railway Postgres successfully');

    // Primeiro, vamos dropar as tabelas existentes na ordem correta
    console.log('Dropping existing tables...');
    await pgClient.query(`
      DROP TABLE IF EXISTS self_evaluation_scores CASCADE;
      DROP TABLE IF EXISTS self_evaluations CASCADE;
      DROP TABLE IF EXISTS evaluation_criteria_scores CASCADE;
      DROP TABLE IF EXISTS evaluations CASCADE;
      DROP TABLE IF EXISTS matrix_applicability CASCADE;
      DROP TABLE IF EXISTS evaluation_criteria CASCADE;
      DROP TABLE IF EXISTS evaluation_matrices CASCADE;
      DROP TABLE IF EXISTS employees CASCADE;
    `);

    // Criar tabela de funcionários
    console.log('Creating employees table...');
    await pgClient.query(`
      CREATE TABLE employees (
        employee_number TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        active BOOLEAN,
        company_name TEXT,
        user_id TEXT UNIQUE, -- ID do Azure Entra ID, should be unique for FK reference
        department TEXT,
        admission_date TIMESTAMP,
        sync_status TEXT,
        current BOOLEAN,
        termination_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        identity_card TEXT,
        last_sync TIMESTAMP,
        passport_number TEXT,
        salary_rule TEXT,
        schedule_id TEXT
      );
      CREATE INDEX idx_employees_user_id ON employees(user_id);
    `);

    // Criar tabela de matrizes de avaliação
    console.log('Creating evaluation_matrices table...');
    await pgClient.query(`
      CREATE TABLE evaluation_matrices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
        created_by_manager_id TEXT NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE, -- Changed FK to user_id
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT, -- UPN of the user who inserted/updated the record via the app
        updated_by TEXT  -- UPN of the user who inserted/updated the record via the app
      );
    `);

    // Criar tabela de critérios de avaliação
    console.log('Creating evaluation_criteria table...');
    await pgClient.query(`
      CREATE TABLE evaluation_criteria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matrix_id UUID NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        weight DECIMAL(5,2) NOT NULL,
        is_competency_gap_critical BOOLEAN DEFAULT false,
        min_score_possible INTEGER DEFAULT 0,
        max_score_possible INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE
      );
    `);

    // Criar tabela de aplicabilidade de matrizes
    console.log('Creating matrix_applicability table...');
    await pgClient.query(`
      CREATE TABLE matrix_applicability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matrix_id UUID NOT NULL,
        employee_id TEXT NOT NULL,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
        inactivated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_number) ON DELETE CASCADE
      );
    `);

    // Criar tabela de avaliações
    console.log('Creating evaluations table...');
    await pgClient.query(`
      CREATE TABLE evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matrix_id UUID NOT NULL,
        employee_id TEXT NOT NULL,
        evaluator_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'in_progress', 'submitted', 'acknowledged')),
        total_weighted_score DECIMAL(5,2),
        manager_overall_comments TEXT,
        employee_acknowledgement_comments TEXT,
        submitted_at TIMESTAMP,
        acknowledged_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_number) ON DELETE CASCADE,
        FOREIGN KEY (evaluator_id) REFERENCES employees(employee_number) ON DELETE CASCADE
      );
    `);

    // Criar tabela de scores de avaliação
    console.log('Creating evaluation_criteria_scores table...');
    await pgClient.query(`
      CREATE TABLE evaluation_criteria_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluation_id UUID NOT NULL,
        criterion_id UUID NOT NULL,
        achievement_percentage DECIMAL(5,2) NOT NULL,
        criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
        normalized_score DECIMAL(5,2) NOT NULL,
        final_weighted_score DECIMAL(5,2) NOT NULL,
        manager_criterion_comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE CASCADE
      );
    `);

    // Criar tabela de auto-avaliações
    console.log('Creating self_evaluations table...');
    await pgClient.query(`
      CREATE TABLE self_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        matrix_id UUID NOT NULL,
        employee_id TEXT NOT NULL,
        evaluation_period_month DATE NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'in_progress', 'submitted')),
        total_weighted_score DECIMAL(5,2),
        employee_overall_comments TEXT,
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        manager_id TEXT NOT NULL,
        FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_number) ON DELETE CASCADE,
        FOREIGN KEY (manager_id) REFERENCES employees(employee_number) ON DELETE CASCADE
      );
    `);

    // Criar tabela de scores de auto-avaliação
    console.log('Creating self_evaluation_scores table...');
    await pgClient.query(`
      CREATE TABLE self_evaluation_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        self_evaluation_id UUID NOT NULL,
        criterion_id UUID NOT NULL,
        achievement_percentage DECIMAL(5,2) NOT NULL,
        criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
        normalized_score DECIMAL(5,2) NOT NULL,
        final_weighted_score DECIMAL(5,2) NOT NULL,
        employee_criterion_comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (self_evaluation_id) REFERENCES self_evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id) ON DELETE CASCADE
      );
    `);

    console.log('All tables created successfully!');

  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main(); 