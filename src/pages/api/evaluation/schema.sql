-- Create evaluation matrices table
CREATE TABLE IF NOT EXISTS evaluation_matrices (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by_manager_id VARCHAR(255) NOT NULL,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_created_by_manager FOREIGN KEY (created_by_manager_id) REFERENCES employees(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create evaluation criteria table
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id SERIAL PRIMARY KEY,
  matrix_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  weight DECIMAL(5,2) NOT NULL,
  is_competency_gap_critical BOOLEAN DEFAULT false,
  min_score_possible DECIMAL(5,2) DEFAULT 0,
  max_score_possible DECIMAL(5,2) DEFAULT 100,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matrix FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create evaluation matrix applicability table
CREATE TABLE IF NOT EXISTS evaluation_matrix_applicability (
  id SERIAL PRIMARY KEY,
  matrix_id INTEGER NOT NULL,
  employee_id VARCHAR(255) NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matrix FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id) ON DELETE CASCADE,
  CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create employee evaluations table
CREATE TABLE IF NOT EXISTS employee_evaluations (
  id SERIAL PRIMARY KEY,
  matrix_id INTEGER NOT NULL,
  employee_id VARCHAR(255) NOT NULL,
  evaluator_id VARCHAR(255) NOT NULL,
  evaluation_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_score DECIMAL(5,2),
  total_weighted_score DECIMAL(5,2),
  comments TEXT,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matrix FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id),
  CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_evaluator FOREIGN KEY (evaluator_id) REFERENCES employees(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create employee evaluation scores table
CREATE TABLE IF NOT EXISTS employee_evaluation_scores (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  weighted_score DECIMAL(5,2) NOT NULL,
  comments TEXT,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evaluation FOREIGN KEY (evaluation_id) REFERENCES employee_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_criterion FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create self evaluations table
CREATE TABLE IF NOT EXISTS self_evaluations (
  id SERIAL PRIMARY KEY,
  matrix_id INTEGER NOT NULL,
  employee_id VARCHAR(255) NOT NULL,
  evaluation_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_score DECIMAL(5,2),
  total_weighted_score DECIMAL(5,2),
  comments TEXT,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matrix FOREIGN KEY (matrix_id) REFERENCES evaluation_matrices(id),
  CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create self evaluation scores table
CREATE TABLE IF NOT EXISTS self_evaluation_scores (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  weighted_score DECIMAL(5,2) NOT NULL,
  comments TEXT,
  created_by_user_id VARCHAR(255) NOT NULL,
  updated_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evaluation FOREIGN KEY (evaluation_id) REFERENCES self_evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_criterion FOREIGN KEY (criterion_id) REFERENCES evaluation_criteria(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- Create evaluation notifications table
CREATE TABLE IF NOT EXISTS evaluation_notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  recipient_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id VARCHAR(255) NOT NULL,
  CONSTRAINT fk_recipient FOREIGN KEY (recipient_id) REFERENCES users(id),
  CONSTRAINT fk_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_evaluation_matrices_status ON evaluation_matrices(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_matrices_valid_from ON evaluation_matrices(valid_from);
CREATE INDEX IF NOT EXISTS idx_evaluation_matrices_valid_to ON evaluation_matrices(valid_to);
CREATE INDEX IF NOT EXISTS idx_evaluation_matrices_created_by_manager ON evaluation_matrices(created_by_manager_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_matrix ON evaluation_criteria(matrix_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_matrix ON evaluation_matrix_applicability(matrix_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_employee ON evaluation_matrix_applicability(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_matrix_applicability_status ON evaluation_matrix_applicability(status);

CREATE INDEX IF NOT EXISTS idx_employee_evaluations_matrix ON employee_evaluations(matrix_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_employee ON employee_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_evaluator ON employee_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_status ON employee_evaluations(status);

CREATE INDEX IF NOT EXISTS idx_employee_evaluation_scores_evaluation ON employee_evaluation_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluation_scores_criterion ON employee_evaluation_scores(criterion_id);

CREATE INDEX IF NOT EXISTS idx_self_evaluations_matrix ON self_evaluations(matrix_id);
CREATE INDEX IF NOT EXISTS idx_self_evaluations_employee ON self_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_self_evaluations_status ON self_evaluations(status);

CREATE INDEX IF NOT EXISTS idx_self_evaluation_scores_evaluation ON self_evaluation_scores(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_self_evaluation_scores_criterion ON self_evaluation_scores(criterion_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_recipient ON evaluation_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_status ON evaluation_notifications(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_type ON evaluation_notifications(type);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_created_at ON evaluation_notifications(created_at); 