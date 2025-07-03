-- Create evaluation_notifications table
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
  created_by_user_id VARCHAR(255) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_recipient ON evaluation_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_status ON evaluation_notifications(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_type ON evaluation_notifications(type);
CREATE INDEX IF NOT EXISTS idx_evaluation_notifications_created_at ON evaluation_notifications(created_at);

-- Add comments to the table and columns
COMMENT ON TABLE evaluation_notifications IS 'Stores notifications for evaluation-related events';
COMMENT ON COLUMN evaluation_notifications.type IS 'Type of notification: evaluation_due, evaluation_pending, self_evaluation_due';
COMMENT ON COLUMN evaluation_notifications.recipient_id IS 'ID of the user who should receive the notification';
COMMENT ON COLUMN evaluation_notifications.status IS 'Status of the notification: pending, sent, read';
COMMENT ON COLUMN evaluation_notifications.metadata IS 'Additional data related to the notification (e.g., evaluation_id)'; 