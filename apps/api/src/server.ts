import type { Server } from 'node:http';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

// Re-export createApp so existing imports from server.js continue to work
export { createApp };

let serverInstance: Server | null = null;

/**
 * Boots the server by validating the environment, connecting to MongoDB,
 * starting the HTTP listener, and setting up graceful shutdown handlers.
 */
export async function startServer(): Promise<Server> {
  const env = getEnv();

  console.log(`[api] Starting Placement Platform API in ${env.NODE_ENV} mode...`);

  // Step 1: Connect to MongoDB
  try {
    console.log('[api] Connecting to MongoDB...');
    await connectDatabase(env.MONGODB_URI);
  } catch (error) {
    console.error(
      '[fatal] Could not connect to MongoDB. Server startup aborted.\n' +
        'Please verify your MONGODB_URI connection string in your .env file.\n' +
        `Error details: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Step 2: Create Express application and start listening
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(
      `[api] Placement Platform API running on http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });

  serverInstance = server;

  // Step 3: Graceful shutdown handlers
  const handleShutdown = async (signal: string) => {
    console.log(`\n[api] Received ${signal}. Shutting down gracefully...`);
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[api] HTTP server closed.');
      });
    }
    try {
      await disconnectDatabase();
      console.log('[api] Database connection closed.');
    } catch (err) {
      console.error('[api] Error during database disconnect:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void handleShutdown('SIGINT'));
  process.on('SIGTERM', () => void handleShutdown('SIGTERM'));

  return server;
}

// ── Only auto-start when running outside test environment ─────────────────────
// When Vitest imports createApp or server, NODE_ENV is 'test', so it won't bind
// network ports or attempt live database connections.
if (process.env['NODE_ENV'] !== 'test') {
  startServer().catch((err) => {
    console.error('[fatal] Unexpected error during server startup:', err);
    process.exit(1);
  });
}

export default createApp;
