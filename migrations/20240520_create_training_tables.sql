-- Create training sessions table
CREATE TABLE IF NOT EXISTS training_sessions (
    id SERIAL PRIMARY KEY,
    employee_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    location TEXT,
    trainer TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_employee ON training_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_start_date ON training_sessions(start_date);
CREATE INDEX IF NOT EXISTS idx_training_end_date ON training_sessions(end_date);

-- Trigger to update updated_at column
CREATE TRIGGER update_training_sessions_updated_at
    BEFORE UPDATE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
