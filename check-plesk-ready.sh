#!/bin/bash

# ============================================
# Quick Check Script for Plesk Deployment
# ============================================
# Run this before deploying to check if ready
# ============================================

echo "=========================================="
echo "🔍 Plesk Deployment Readiness Check"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Check 1: .env file
echo "1️⃣ Checking .env file..."
if [ -f .env ]; then
    echo "   ✅ .env exists"
    
    # Check for required variables
    if grep -q "MONGODB_URI=mongodb" .env; then
        echo "   ✅ MONGODB_URI configured"
    else
        echo "   ❌ MONGODB_URI not configured"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "DATABASE_URL=" .env; then
        echo "   ✅ DATABASE_URL configured"
    else
        echo "   ⚠️  DATABASE_URL not configured"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "   ❌ .env file missing!"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 2: credentials.json
echo "2️⃣ Checking credentials.json..."
if [ -f credentials.json ]; then
    echo "   ✅ credentials.json exists"
    
    # Check if valid JSON
    if cat credentials.json | python -m json.tool > /dev/null 2>&1 || cat credentials.json | node -e "JSON.parse(require('fs').readFileSync(0))" 2>&1; then
        echo "   ✅ credentials.json is valid JSON"
    else
        echo "   ❌ credentials.json is invalid JSON"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ⚠️  credentials.json missing (required for Google Sheets)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: package.json
echo "3️⃣ Checking package.json..."
if [ -f package.json ]; then
    echo "   ✅ package.json exists"
else
    echo "   ❌ package.json missing!"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 4: Required directories
echo "4️⃣ Checking directories..."
for dir in app lib components; do
    if [ -d "$dir" ]; then
        echo "   ✅ $dir/ exists"
    else
        echo "   ❌ $dir/ missing!"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# Check 5: Shell scripts
echo "5️⃣ Checking shell scripts..."
for script in app.js plesk-setup.sh .plesk-deploy.sh; do
    if [ -f "$script" ]; then
        echo "   ✅ $script exists"
    else
        echo "   ⚠️  $script missing"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

# Summary
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED!"
    echo "=========================================="
    echo "Ready to deploy to Plesk Obsidian! 🚀"
    echo ""
    echo "Next steps:"
    echo "1. Push to Git: git push origin master"
    echo "2. Configure Plesk Node.js settings"
    echo "3. Upload .env and credentials.json manually"
    echo "4. Run: bash plesk-setup.sh on server"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  PASSED WITH WARNINGS"
    echo "=========================================="
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "You can deploy but some features may not work."
    exit 0
else
    echo "❌ FAILED"
    echo "=========================================="
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Please fix errors before deploying."
    exit 1
fi
