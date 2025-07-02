-- Performance Evaluation & Feedback Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS evaluation;

-- Set search path
SET search_path TO evaluation, public;

-- Evaluation Matrices
CREATE TABLE IF NOT EXISTS evaluation_matrices (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    employee_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    updated_by_user_id TEXT,
    CONSTRAINT evaluation_matrices_title_valid_from_valid_to_employee UNIQUE (title, valid_from, valid_to, employee_id)
);

-- Evaluation Criteria
CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
    is_cutting BOOLEAN DEFAULT FALSE,
    min_score_possible NUMERIC(3, 1) DEFAULT 0.0 NOT NULL,
    max_score_possible NUMERIC(3, 1) DEFAULT 10.0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    updated_by_user_id TEXT
);

-- Matrix Applicability
CREATE TABLE IF NOT EXISTS evaluation_matrix_applicability (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    assigned_by_employee_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_system_user_id TEXT,
    updated_by_system_user_id TEXT,
    CONSTRAINT evaluation_matrix_applicability_unique UNIQUE (matrix_id, employee_id, valid_from, valid_to)
);

-- Employee Evaluations
CREATE TABLE IF NOT EXISTS employee_evaluations (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
    employee_id TEXT NOT NULL,
    manager_id TEXT NOT NULL,
    evaluation_period_month DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'validated', 'cancelled')),
    total_weighted_score NUMERIC(5, 2),
    manager_overall_comments TEXT,
    employee_acknowledgement_comments TEXT,
    validated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    updated_by_user_id TEXT,
    CONSTRAINT employee_evaluations_unique UNIQUE (employee_id, evaluation_period_month, matrix_id)
);

-- Self Evaluations
CREATE TABLE IF NOT EXISTS self_evaluations (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
    employee_id TEXT NOT NULL,
    evaluation_period_month DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'validated', 'cancelled')),
    total_weighted_score NUMERIC(5, 2),
    self_assessment_comments TEXT,
    validated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    updated_by_user_id TEXT,
    CONSTRAINT self_evaluations_unique UNIQUE (employee_id, evaluation_period_month, matrix_id)
);

-- Evaluation Scores
CREATE TABLE IF NOT EXISTS evaluation_scores (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL,
    evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('employee', 'self')),
    criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id),
    score NUMERIC(3, 1) NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    updated_by_user_id TEXT,
    CONSTRAINT evaluation_scores_unique UNIQUE (evaluation_id, evaluation_type, criterion_id)
);

-- Evaluation Logs
CREATE TABLE IF NOT EXISTS evaluation_logs (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL,
    evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('employee', 'self')),
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    old_data JSONB,
    new_data JSONB
);

-- Create indexes
CREATE INDEX idx_evaluation_matrices_employee ON evaluation_matrices(employee_id);
CREATE INDEX idx_evaluation_matrices_status ON evaluation_matrices(status);
CREATE INDEX idx_evaluation_criteria_matrix ON evaluation_criteria(matrix_id);
CREATE INDEX idx_matrix_applicability_matrix ON evaluation_matrix_applicability(matrix_id);
CREATE INDEX idx_matrix_applicability_employee ON evaluation_matrix_applicability(employee_id);
CREATE INDEX idx_employee_evaluations_matrix ON employee_evaluations(matrix_id);
CREATE INDEX idx_employee_evaluations_employee ON employee_evaluations(employee_id);
CREATE INDEX idx_employee_evaluations_manager ON employee_evaluations(manager_id);
CREATE INDEX idx_employee_evaluations_status ON employee_evaluations(status);
CREATE INDEX idx_self_evaluations_matrix ON self_evaluations(matrix_id);
CREATE INDEX idx_self_evaluations_employee ON self_evaluations(employee_id);
CREATE INDEX idx_self_evaluations_status ON self_evaluations(status);
CREATE INDEX idx_evaluation_scores_evaluation ON evaluation_scores(evaluation_id, evaluation_type);
CREATE INDEX idx_evaluation_scores_criterion ON evaluation_scores(criterion_id);
CREATE INDEX idx_evaluation_logs_evaluation ON evaluation_logs(evaluation_id, evaluation_type);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_evaluation_matrices_updated_at
    BEFORE UPDATE ON evaluation_matrices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_criteria_updated_at
    BEFORE UPDATE ON evaluation_criteria
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_evaluations_updated_at
    BEFORE UPDATE ON employee_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_self_evaluations_updated_at
    BEFORE UPDATE ON self_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_scores_updated_at
    BEFORE UPDATE ON evaluation_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 