#!/usr/bin/env node

/**
 * Quick Start Script
 * Run this after npm install to set up the project
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('🚀 Quick Start Setup');
console.log('========================================');
console.log('');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');
const envLocalPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  if (fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envLocalPath, envPath);
    console.log('✅ .env created from .env.local');
  } else if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env created from .env.example');
  } else {
    // Create basic .env
    const basicEnv = `# Auto-generated .env file
CRON_SYNC_TOKEN=dev_token_${Date.now()}
NEXT_PUBLIC_CRON_TOKEN=public_token_${Date.now()}
ADMIN_PASSWORD=admin123
NODE_ENV=development
PORT=3000
`;
    fs.writeFileSync(envPath, basicEnv);
    console.log('✅ .env created with default values');
  }
} else {
  console.log('✅ .env file already exists');
}

// Check credentials.json
const credPath = path.join(__dirname, 'credentials.json');
if (!fs.existsSync(credPath)) {
  console.log('');
  console.log('⚠️  credentials.json not found');
  console.log('   Google Sheets sync will not work until you add this file');
  console.log('   Download from: https://console.cloud.google.com/apis/credentials');
  console.log('   (Application will still run without it)');
}

console.log('');
console.log('========================================');
console.log('✅ Setup Complete!');
console.log('========================================');
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run dev');
console.log('2. Open: http://localhost:3000');
console.log('3. Login with: admin / admin123');
console.log('');
console.log('For production:');
console.log('1. Configure .env file with real values');
console.log('2. Add credentials.json');
console.log('3. Run: npm run build && npm start');
console.log('');
