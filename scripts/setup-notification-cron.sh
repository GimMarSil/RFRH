#!/bin/bash

# Check if crontab is available
if ! command -v crontab &> /dev/null; then
    echo "Error: crontab is not installed"
    exit 1
fi

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Create a temporary file for the new crontab
TEMP_CRON=$(mktemp)

# Export the current crontab
crontab -l > "$TEMP_CRON" 2>/dev/null || echo "# Notification cron jobs" > "$TEMP_CRON"

# Add the notification check job (runs daily at 9 AM)
echo "0 9 * * * curl -X POST http://localhost:3000/api/evaluation/notifications/check -H 'Content-Type: application/json' -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'" >> "$TEMP_CRON"

# Install the new crontab
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

echo "Notification cron job has been set up successfully!"
echo "The job will run daily at 9 AM."
echo "Please make sure to replace 'YOUR_ADMIN_TOKEN' with a valid admin token." 