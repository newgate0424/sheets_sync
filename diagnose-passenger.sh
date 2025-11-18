#!/bin/bash

# ============================================
# Plesk/Passenger Troubleshooting Script
# ============================================
# Run this on the server to diagnose issues
# ============================================

echo "=========================================="
echo "🔍 Passenger/Plesk Diagnostics"
echo "=========================================="
echo ""

# 1. Check Node.js version
echo "1️⃣ Node.js Version:"
node --version
echo ""

# 2. Check if files exist
echo "2️⃣ Critical Files:"
for file in .env credentials.json package.json app.js; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file MISSING!"
    fi
done
echo ""

# 3. Check .next directory
echo "3️⃣ Build Status:"
if [ -d .next ]; then
    echo "   ✅ .next directory exists"
    if [ -f .next/BUILD_ID ]; then
        echo "   ✅ BUILD_ID: $(cat .next/BUILD_ID)"
    fi
else
    echo "   ❌ .next directory MISSING - Need to run: npm run build"
fi
echo ""

# 4. Check node_modules
echo "4️⃣ Dependencies:"
if [ -d node_modules ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ❌ node_modules MISSING - Need to run: npm install"
fi
echo ""

# 5. Test app.js syntax
echo "5️⃣ Testing app.js syntax:"
node -c app.js && echo "   ✅ app.js syntax OK" || echo "   ❌ app.js has syntax errors"
echo ""

# 6. Check environment variables
echo "6️⃣ Environment Variables (.env):"
if [ -f .env ]; then
    echo "   MONGODB_URI: $(grep -q MONGODB_URI .env && echo '✓ Set' || echo '✗ Missing')"
    echo "   DATABASE_URL: $(grep -q DATABASE_URL .env && echo '✓ Set' || echo '✗ Missing')"
    echo "   NODE_ENV: $(grep NODE_ENV .env | cut -d= -f2)"
    echo "   PORT: $(grep PORT .env | cut -d= -f2)"
else
    echo "   ❌ .env file missing"
fi
echo ""

# 7. Check logs
echo "7️⃣ Recent Logs:"
if [ -d logs ]; then
    echo "   Logs directory exists:"
    ls -lh logs/ 2>/dev/null || echo "   No log files yet"
else
    echo "   ⚠️  logs/ directory not found"
fi
echo ""

# 8. Check Passenger
echo "8️⃣ Passenger Status:"
if command -v passenger-status &> /dev/null; then
    passenger-status 2>/dev/null || echo "   ⚠️  Cannot get Passenger status (may need sudo)"
else
    echo "   ⚠️  Passenger command not found"
fi
echo ""

# 9. Test database connections
echo "9️⃣ Testing Database Connections:"
if [ -f .env ]; then
    source .env 2>/dev/null
    
    # Test MongoDB
    if [ ! -z "$MONGODB_URI" ]; then
        echo "   Testing MongoDB..."
        node -e "
            require('mongodb').MongoClient.connect('$MONGODB_URI')
                .then(() => { console.log('   ✅ MongoDB connection OK'); process.exit(0); })
                .catch(err => { console.log('   ❌ MongoDB error:', err.message); process.exit(1); })
        " 2>&1 | head -1
    else
        echo "   ⚠️  MONGODB_URI not set"
    fi
    
    # Test MySQL
    if [ ! -z "$DATABASE_URL" ] && [[ $DATABASE_URL == mysql* ]]; then
        echo "   ✅ MySQL URL configured"
    fi
fi
echo ""

# 10. Recommended actions
echo "=========================================="
echo "📋 Recommended Actions:"
echo "=========================================="
echo ""

ISSUES=0

if [ ! -d .next ]; then
    echo "❌ Run: npm run build"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -d node_modules ]; then
    echo "❌ Run: npm install"
    ISSUES=$((ISSUES + 1))
fi

if [ ! -f .env ]; then
    echo "❌ Create .env file with proper configuration"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ All checks passed!"
    echo ""
    echo "To restart the app:"
    echo "  touch tmp/restart.txt"
    echo ""
    echo "To view logs:"
    echo "  tail -f logs/*.log"
    echo "  # or Plesk logs"
    echo "  tail -f /var/www/vhosts/domain.com/logs/error_log"
else
    echo ""
    echo "Found $ISSUES issue(s) that need fixing"
fi

echo ""
echo "=========================================="
