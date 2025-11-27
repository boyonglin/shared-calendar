/**
 * Database abstraction layer
 *
 * Automatically selects the appropriate database driver:
 * - Local development: better-sqlite3 (synchronous, file-based)
 * - Vercel/Production: Turso via @libsql/client (edge-compatible)
 */
import type { Client as TursoClient } from "@libsql/client";
import type Database from "better-sqlite3";

// Type definitions for unified database interface
export interface DatabaseResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface PreparedStatement<T = unknown> {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): DatabaseResult;
}

// Detect if we're running on Vercel
const isVercel = process.env.VERCEL === "1" || !!process.env.TURSO_DATABASE_URL;

let dbInstance: Database.Database | TursoClient | null = null;

/**
 * Get the database instance
 * For Turso, this is async; for better-sqlite3, it's sync
 */
export async function getDatabase(): Promise<Database.Database | TursoClient> {
  if (dbInstance) return dbInstance;

  if (isVercel) {
    // Use Turso for Vercel deployment
    const { createClient } = await import("@libsql/client");
    dbInstance = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Initialize schema
    await initializeTursoSchema(dbInstance as TursoClient);
  } else {
    // Use better-sqlite3 for local development
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const path = await import("path");
    const dbPath = path.join(__dirname, "../../shared-calendar.db");
    dbInstance = new BetterSqlite3(dbPath);

    // Enable foreign keys
    (dbInstance as Database.Database).pragma("foreign_keys = ON");

    // Initialize schema
    initializeSqliteSchema(dbInstance as Database.Database);
  }

  return dbInstance;
}

/**
 * Initialize Turso database schema
 */
async function initializeTursoSchema(client: TursoClient): Promise<void> {
  await client.execute(`
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
  `);

  await client.execute(`
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
  `);

  // Create indexes
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id)",
  ];

  for (const sql of indexes) {
    await client.execute(sql);
  }

  console.log("✅ Turso database initialized");
}

/**
 * Initialize SQLite database schema (better-sqlite3)
 */
function initializeSqliteSchema(db: Database.Database): void {
  db.exec(`
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
  `);

  // Add primary_user_id column if it doesn't exist (migration)
  try {
    db.exec("ALTER TABLE calendar_accounts ADD COLUMN primary_user_id TEXT");
    console.log("✅ Added primary_user_id column to calendar_accounts");
  } catch {
    // Column already exists
  }

  db.exec(`
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
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email);
    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id);
    CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email);
    CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id);
  `);

  console.log("✅ SQLite database initialized");
}

/**
 * Check if running with Turso
 */
export function isTursoEnabled(): boolean {
  return isVercel;
}

// Export for backwards compatibility - synchronous version for local dev
// This will be initialized when the module loads in non-Vercel environments
export let db: Database.Database;

if (!isVercel) {
  // Synchronous initialization for local development
  import("better-sqlite3").then((BetterSqlite3Module) => {
    import("path").then((path) => {
      const dbPath = path.join(__dirname, "../../shared-calendar.db");
      db = new BetterSqlite3Module.default(dbPath);
      (db as Database.Database).pragma("foreign_keys = ON");
      initializeSqliteSchema(db);
    });
  });
}
