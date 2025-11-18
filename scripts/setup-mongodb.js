// สคริปต์สำหรับตั้งค่า MongoDB indexes และสร้าง admin user เริ่มต้น
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// อ่าน .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  const lines = envFile.split('\n');
  
  const env = {};
  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  });
  
  return env;
}

async function setupMongoDB() {
  const env = loadEnv();
  
  if (!env.DATABASE_USER_URL) {
    console.error('❌ DATABASE_USER_URL not found in .env file');
    process.exit(1);
  }
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(env.DATABASE_USER_URL);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // แยก database name จาก connection string
    const url = new URL(env.DATABASE_USER_URL);
    const dbName = url.pathname.substring(1).split('?')[0] || 'user';
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    
    // สร้าง unique index สำหรับ username
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    console.log('✓ Created unique index on username');
    
    // สร้าง index สำหรับ is_active
    await usersCollection.createIndex({ is_active: 1 });
    console.log('✓ Created index on is_active');
    
    // ตรวจสอบว่ามี admin user หรือยัง
    const adminCount = await usersCollection.countDocuments({ role: 'admin' });
    
    if (adminCount === 0) {
      console.log('\nNo admin user found. Creating default admin...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await usersCollection.insertOne({
        username: 'admin',
        password: hashedPassword,
        full_name: 'Administrator',
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        last_login: null
      });
      
      console.log('✓ Created admin user:');
      console.log('  Username: admin');
      console.log('  Password: admin123');
      console.log('  ⚠️  Please change the password after first login!');
    } else {
      console.log(`\n✓ Found ${adminCount} admin user(s)`);
    }
    
    console.log('\nMongoDB setup completed successfully!');
  } catch (error) {
    console.error('Error setting up MongoDB:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupMongoDB();
