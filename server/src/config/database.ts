import mongoose from 'mongoose';
import { ENV } from './env';

let isConnected = false;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  mongoose.connection.on('connected', () => {
    console.log('✅ Connected to MongoDB successfully.');
    isConnected = true;
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
    isConnected = false;
  });

  try {
    // Attempt connecting to the configured URI (Atlas or Local)
    console.log(`Connecting to MongoDB at: ${ENV.MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}...`);
    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    return conn;
  } catch (error: any) {
    console.warn(`⚠️ Could not connect to primary MongoDB URI: ${error.message}`);

    // If in development/test and primary connection failed, use MongoMemoryServer as transparent fallback
    if (ENV.NODE_ENV !== 'production') {
      try {
        console.log('🔄 Starting embedded in-memory MongoDB engine for zero-configuration local development...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        console.log(`✅ Embedded MongoDB initialized at ${uri}`);
        const conn = await mongoose.connect(uri);
        return conn;
      } catch (fallbackError: any) {
        console.error('❌ Embedded MongoDB fallback failed:', fallbackError.message);
        throw error;
      }
    } else {
      throw error;
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB connection closed.');
  }
}
