import mongoose from 'mongoose';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting';

/**
 * Connect to MongoDB with safe timeouts and event logging.
 * Fails fast (5000ms timeout) if the database server or cluster is unreachable.
 */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  // If already connected, return the existing mongoose instance
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Remove existing listeners to avoid duplicate logs across reconnects
  mongoose.connection.removeAllListeners('error');
  mongoose.connection.removeAllListeners('disconnected');

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    if (process.env['NODE_ENV'] !== 'test') {
      console.warn('[db] MongoDB disconnected.');
    }
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      autoIndex: process.env['NODE_ENV'] !== 'production', // Build indexes automatically in development
    });

    if (process.env['NODE_ENV'] !== 'test') {
      console.log('[db] Successfully connected to MongoDB.');
    }
    return mongoose;
  } catch (error) {
    console.error('[db] Failed to establish MongoDB connection.');
    throw error;
  }
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Returns current database connection state.
 */
export function getDatabaseStatus(): DatabaseStatus {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    case 0:
    default:
      return 'disconnected';
  }
}
