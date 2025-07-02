-- Create evaluation matrices table
CREATE TABLE evaluation_matrices (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (valid_from <= valid_to)
);

-- Create evaluation criteria table
CREATE TABLE evaluation_criteria (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
    is_competency_gap_critical BOOLEAN DEFAULT false,
    min_score_possible INTEGER DEFAULT 0,
    max_score_possible INTEGER DEFAULT 100,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_criterion_name_per_matrix UNIQUE (matrix_id, name),
    CONSTRAINT valid_score_range CHECK (min_score_possible >= 0 AND max_score_possible <= 100 AND min_score_possible <= max_score_possible)
);

-- Create employee evaluations table
CREATE TABLE employee_evaluations (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
    employee_id VARCHAR(255) NOT NULL REFERENCES employees(id),
    manager_id VARCHAR(255) NOT NULL REFERENCES employees(id),
    evaluation_period_month DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'validated', 'cancelled')),
    total_weighted_score DECIMAL(5,2),
    manager_overall_comments TEXT,
    employee_acknowledgement_comments TEXT,
    cancellation_reason TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_user_id VARCHAR(255),
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
);

-- Create employee evaluation scores table
CREATE TABLE employee_evaluation_scores (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER NOT NULL REFERENCES employee_evaluations(id) ON DELETE CASCADE,
    criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id),
    achievement_percentage DECIMAL(5,2) NOT NULL CHECK (achievement_percentage >= 0 AND achievement_percentage <= 100),
    criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
    normalized_score DECIMAL(5,2) NOT NULL,
    final_weighted_score DECIMAL(5,2) NOT NULL,
    manager_criterion_comments TEXT,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_criterion_per_evaluation UNIQUE (evaluation_id, criterion_id)
);

-- Create self evaluations table
CREATE TABLE self_evaluations (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id),
    employee_id VARCHAR(255) NOT NULL REFERENCES employees(id),
    evaluation_period_month DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
    total_weighted_score DECIMAL(5,2),
    employee_overall_comments TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_self_evaluation_per_employee_period_matrix UNIQUE (employee_id, evaluation_period_month, matrix_id)
);

-- Create self evaluation scores table
CREATE TABLE self_evaluation_scores (
    id SERIAL PRIMARY KEY,
    self_evaluation_id INTEGER NOT NULL REFERENCES self_evaluations(id) ON DELETE CASCADE,
    criterion_id INTEGER NOT NULL REFERENCES evaluation_criteria(id),
    achievement_percentage DECIMAL(5,2) NOT NULL CHECK (achievement_percentage >= 0 AND achievement_percentage <= 100),
    criterion_weight_at_evaluation DECIMAL(5,2) NOT NULL,
    normalized_score DECIMAL(5,2) NOT NULL,
    final_weighted_score DECIMAL(5,2) NOT NULL,
    employee_criterion_comments TEXT,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_criterion_per_self_evaluation UNIQUE (self_evaluation_id, criterion_id)
);

-- Create evaluation matrix applicability table
CREATE TABLE evaluation_matrix_applicability (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
    employee_id VARCHAR(255) NOT NULL REFERENCES employees(id),
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    inactivated_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (valid_from <= valid_to),
    CONSTRAINT unique_active_matrix_per_employee UNIQUE (employee_id, matrix_id, status) WHERE status = 'active'
);

-- Create trigger to validate criteria weights sum to 100 for each matrix
CREATE OR REPLACE FUNCTION validate_criteria_weights()
RETURNS TRIGGER AS $$
DECLARE
    total_weight DECIMAL(5,2);
BEGIN
    -- Calculate total weight for the matrix
    SELECT COALESCE(SUM(weight), 0)
    INTO total_weight
    FROM evaluation_criteria
    WHERE matrix_id = NEW.matrix_id;

    -- Check if total weight is 100
    IF total_weight != 100 THEN
        RAISE EXCEPTION 'Criteria weights for matrix_id % must sum to 100, current sum is %', NEW.matrix_id, total_weight;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_criteria_weights
AFTER INSERT OR UPDATE OR DELETE ON evaluation_criteria
FOR EACH ROW
EXECUTE FUNCTION validate_criteria_weights();

-- Create indexes for better query performance
CREATE INDEX idx_evaluation_matrices_status ON evaluation_matrices(status);
CREATE INDEX idx_evaluation_criteria_matrix_id ON evaluation_criteria(matrix_id);
CREATE INDEX idx_employee_evaluations_matrix_id ON employee_evaluations(matrix_id);
CREATE INDEX idx_employee_evaluations_employee_id ON employee_evaluations(employee_id);
CREATE INDEX idx_employee_evaluations_manager_id ON employee_evaluations(manager_id);
CREATE INDEX idx_employee_evaluations_status ON employee_evaluations(status);
CREATE INDEX idx_employee_evaluation_scores_evaluation_id ON employee_evaluation_scores(evaluation_id);
CREATE INDEX idx_employee_evaluation_scores_criterion_id ON employee_evaluation_scores(criterion_id);
CREATE INDEX idx_self_evaluations_matrix_id ON self_evaluations(matrix_id);
CREATE INDEX idx_self_evaluations_employee_id ON self_evaluations(employee_id);
CREATE INDEX idx_self_evaluations_status ON self_evaluations(status);
CREATE INDEX idx_self_evaluation_scores_self_evaluation_id ON self_evaluation_scores(self_evaluation_id);
CREATE INDEX idx_self_evaluation_scores_criterion_id ON self_evaluation_scores(criterion_id);
CREATE INDEX idx_evaluation_matrix_applicability_matrix_id ON evaluation_matrix_applicability(matrix_id);
CREATE INDEX idx_evaluation_matrix_applicability_employee_id ON evaluation_matrix_applicability(employee_id);
CREATE INDEX idx_evaluation_matrix_applicability_status ON evaluation_matrix_applicability(status); 