import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (db) {
    return db;
  }

  const uri = process.env.DATABASE_USER_URL;
  
  if (!uri) {
    throw new Error('DATABASE_USER_URL is not configured');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    
    // Extract database name from connection string or use default
    const dbName = uri.split('/')[3]?.split('?')[0] || 'user';
    db = client.db(dbName);
    
    console.log('MongoDB connected successfully');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function getMongoDb(): Promise<Db> {
  if (!db) {
    return await connectMongoDB();
  }
  return db;
}

export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
