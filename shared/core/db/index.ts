/**
 * Shared Database Layer
 *
 * Uses Turso via @libsql/client for both local development and Vercel deployment.
 * This provides consistency between environments.
 */
import { createClient, type Client } from "@libsql/client";

let dbInstance: Client | null = null;
let isInitialized = false;
let initPromise: Promise<Client> | null = null;

/**
 * Database schema initialization SQL
 */
const SCHEMA_SQL = {
  calendarAccounts: `
    CREATE TABLE IF NOT EXISTS calendar_accounts (
      user_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      encrypted_password TEXT,
      metadata TEXT,
      primary_user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  userConnections: `
    CREATE TABLE IF NOT EXISTS user_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      friend_email TEXT NOT NULL,
      friend_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_email)
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id)",
  ],
};

/**
 * Initialize database schema
 */
async function initializeSchema(client: Client): Promise<void> {
  await client.execute(SCHEMA_SQL.calendarAccounts);
  await client.execute(SCHEMA_SQL.userConnections);

  for (const sql of SCHEMA_SQL.indexes) {
    try {
      await client.execute(sql);
    } catch {
      // Index might already exist
    }
  }
}

/**
 * Get or create the database client
 * Uses promise-based initialization to prevent race conditions
 */
export async function getDb(): Promise<Client> {
  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL environment variable is required");
    }

    dbInstance = createClient({
      url,
      authToken,
    });

    await initializeSchema(dbInstance);
    isInitialized = true;

    return dbInstance;
  })();

  return initPromise;
}

/**
 * Ensure database is initialized (for Vercel serverless)
 */
export async function ensureDbInitialized(): Promise<void> {
  await getDb();
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    isInitialized = false;
    initPromise = null;
  }
}

/**
 * Health check for the database
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
