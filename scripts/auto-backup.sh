#!/bin/bash
# Auto backup script for GitHub

cd /root/clawd || exit 1

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --staged --quiet; then
  echo "No changes to backup"
  exit 0
fi

# Commit with timestamp
git commit -m "Auto backup: $(date '+%Y-%m-%d %H:%M')"

# Push to GitHub
git push origin main

echo "Backup completed successfully"
