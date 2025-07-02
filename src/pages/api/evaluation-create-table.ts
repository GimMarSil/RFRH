import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Create employees view that references SQL Server data
    await client.query(`
      CREATE OR REPLACE VIEW employees AS
      SELECT 
        CAST([Number] AS VARCHAR) as id,
        [Name] as name,
        [Email] as email,
        [CompanyName] as company_name,
        [Department] as department,
        [UserId] as user_id,
        [Active] as active,
        [AdmissionDate] as admission_date,
        [TerminationDate] as termination_date,
        [CreatedAt] as created_at,
        [UpdatedAt] as updated_at
      FROM dblink(
        'dbname=${process.env.SQL_DATABASE} user=${process.env.SQL_USER} password=${process.env.SQL_PASSWORD} host=${process.env.SQL_SERVER}',
        'SELECT [Number], [Name], [Email], [CompanyName], [Department], [UserId], [Active], [AdmissionDate], [TerminationDate], [CreatedAt], [UpdatedAt] FROM [RFWebApp].[dbo].[Employee] WHERE [Active] = 1'
      ) AS t(
        [Number] VARCHAR,
        [Name] VARCHAR,
        [Email] VARCHAR,
        [CompanyName] VARCHAR,
        [Department] VARCHAR,
        [UserId] VARCHAR,
        [Active] BIT,
        [AdmissionDate] DATE,
        [TerminationDate] DATE,
        [CreatedAt] DATETIME,
        [UpdatedAt] DATETIME
      );
    `);

    // Create evaluation matrices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_matrices (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        valid_from DATE NOT NULL,
        valid_to DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_date_range CHECK (valid_from <= valid_to)
      );
    `);

    // Create evaluation criteria table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_criteria (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
        is_competency_gap_critical BOOLEAN DEFAULT false,
        min_score_possible INTEGER DEFAULT 0,
        max_score_possible INTEGER DEFAULT 100,
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_name_per_matrix UNIQUE (matrix_id, name),
        CONSTRAINT valid_score_range CHECK (min_score_possible >= 0 AND max_score_possible <= 100 AND min_score_possible <= max_score_possible)
      );
    `);

    // Create employee evaluations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_evaluations (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
        employee_id VARCHAR(255) NOT NULL,
        manager_id VARCHAR(255) NOT NULL,
        evaluation_period_month DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'validated', 'cancelled')),
        total_weighted_score DECIMAL(5,2),
        manager_overall_comments TEXT,
        employee_acknowledgement_comments TEXT,
        cancellation_reason TEXT,
        validated_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancelled_by_user_id VARCHAR(255),
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
      );
    `);

    // Create employee evaluation scores table
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
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_per_evaluation UNIQUE (evaluation_id, criterion_id)
      );
    `);

    // Create self evaluations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS self_evaluations (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
        employee_id VARCHAR(255) NOT NULL,
        evaluation_period_month DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
        total_weighted_score DECIMAL(5,2),
        employee_overall_comments TEXT,
        submitted_at TIMESTAMPTZ,
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_self_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
      );
    `);

    // Create self evaluation scores table
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
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_criterion_per_self_evaluation UNIQUE (self_evaluation_id, criterion_id)
      );
    `);

    // Create evaluation matrix applicability table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluation_matrix_applicability (
        id SERIAL PRIMARY KEY,
        matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
        employee_id VARCHAR(255) NOT NULL,
        valid_from DATE NOT NULL,
        valid_to DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        inactivated_at TIMESTAMPTZ,
        created_by_user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_date_range CHECK (valid_from <= valid_to),
        CONSTRAINT unique_active_matrix_per_employee UNIQUE (employee_id, matrix_id, status) WHERE status = 'active'
      );
    `);

    // Create indexes
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

    await client.query('COMMIT');
    res.status(200).json({ message: 'Tables created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error);
    res.status(500).json({ 
      message: 'Error creating tables',
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
  }
} 