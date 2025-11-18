# ไฟล์นี้จะถูกใช้โดย Plesk Git deployment
# Deploy script for Plesk Git integration

#!/bin/bash
set -e

echo "================================"
echo "  Plesk Git Deployment Started  "
echo "================================"

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "📦 Installing dependencies..."
npm ci --production=false

echo ""
echo "🔨 Building application..."
NODE_ENV=production npm run build

echo ""
echo "🗑️  Cleaning dev dependencies..."
npm prune --production

echo ""
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart bigquery-app 2>/dev/null || pm2 start ecosystem.config.json
    pm2 save
    echo "✅ PM2 restart completed"
else
    # For Plesk Node.js without PM2
    touch /tmp/restart.txt
    echo "✅ Application will restart automatically"
fi

echo ""
echo "================================"
echo "  ✅ Deployment Completed!      "
echo "================================"
echo ""
echo "📊 Application Status:"
if command -v pm2 &> /dev/null; then
    pm2 list
fi

exit 0
