#!/bin/bash

# Deployment script for Plesk
echo "Starting deployment..."

# 1. Install dependencies
echo "Installing dependencies..."
npm install --production

# 2. Build the project
echo "Building Next.js application..."
npm run build

# 3. Restart PM2 process (if using PM2)
echo "Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart bigquery-app || pm2 start npm --name "bigquery-app" -- start
else
    echo "PM2 not found, skipping restart"
fi

echo "Deployment completed successfully!"
