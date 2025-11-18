#!/bin/bash

echo "========================================="
echo "🔍 Production Server Health Check Script"
echo "========================================="
echo ""

# 1. Check if .env file exists
echo "1️⃣ Checking .env file..."
if [ -f .env ]; then
    echo "   ✅ .env file exists"
    echo "   📋 Environment variables:"
    grep -E "^(MONGODB_URI|DATABASE_USER_URL|DATABASE_URL|DB_NAME)=" .env | sed 's/=.*/=***/' || echo "   ⚠️  Missing required variables"
else
    echo "   ❌ .env file NOT FOUND!"
fi
echo ""

# 2. Check Node.js version
echo "2️⃣ Checking Node.js version..."
node --version
echo ""

# 3. Check if .next folder exists
echo "3️⃣ Checking build folder..."
if [ -d .next ]; then
    echo "   ✅ .next folder exists"
    ls -lh .next/standalone/server.js 2>/dev/null || echo "   ⚠️  Standalone server not found"
else
    echo "   ❌ .next folder NOT FOUND! Need to run: npm run build"
fi
echo ""

# 4. Check if node_modules exists
echo "4️⃣ Checking dependencies..."
if [ -d node_modules ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ❌ node_modules NOT FOUND! Need to run: npm install"
fi
echo ""

# 5. Check process
echo "5️⃣ Checking running processes..."
ps aux | grep -E "(node|next|pm2)" | grep -v grep || echo "   ⚠️  No Node.js processes running"
echo ""

# 6. Check port 3000
echo "6️⃣ Checking port 3000..."
netstat -tuln | grep ":3000" || lsof -i :3000 || echo "   ⚠️  Port 3000 is not listening"
echo ""

# 7. Test local connection
echo "7️⃣ Testing local connection..."
curl -s http://localhost:3000/api/health | head -20 || echo "   ❌ Cannot connect to localhost:3000"
echo ""

# 8. Check logs
echo "8️⃣ Recent logs (if using PM2)..."
pm2 logs --lines 10 --nostream 2>/dev/null || echo "   ⚠️  PM2 not installed or not running"
echo ""

# 9. Check MySQL connection
echo "9️⃣ Testing MySQL connection..."
mysql -V 2>/dev/null || echo "   ⚠️  MySQL client not installed"
echo ""

# 10. Check MongoDB connection
echo "🔟 Testing MongoDB connection..."
echo "   Use this command to test:"
echo '   node -e "require(\"mongodb\").MongoClient.connect(process.env.MONGODB_URI).then(() => console.log(\"✅ MongoDB OK\")).catch(e => console.log(\"❌\", e.message))"'
echo ""

echo "========================================="
echo "💡 Common Issues & Solutions:"
echo "========================================="
echo ""
echo "❌ Cannot access website:"
echo "   1. Check if process is running: pm2 list"
echo "   2. Check firewall: sudo ufw status"
echo "   3. Check nginx/apache config"
echo "   4. Check domain DNS settings"
echo ""
echo "❌ .env not found:"
echo "   nano .env  (then paste from production.env.txt)"
echo ""
echo "❌ Build failed:"
echo "   rm -rf .next && npm run build"
echo ""
echo "❌ Port 3000 in use:"
echo "   pm2 restart all"
echo "   # or kill: lsof -ti:3000 | xargs kill -9"
echo ""
echo "========================================="
