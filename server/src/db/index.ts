/**
 * Database abstraction layer
 *
 * Supports both:
 * - Local development: better-sqlite3 (synchronous, file-based)
 * - Vercel/Production: Turso via @libsql/client (edge-compatible)
 */
import { createClient, type Client } from "@libsql/client";
import type Database from "better-sqlite3";

// Detect if we're running on Vercel or have Turso configured
const useTurso = process.env.VERCEL === "1" || !!process.env.TURSO_DATABASE_URL;

// Database client type
type DbClient = Client | Database.Database;

let dbInstance: DbClient | null = null;
let isInitialized = false;

/**
 * Get the database client (async for Turso compatibility)
 */
export async function getDb(): Promise<Client> {
  if (dbInstance && isInitialized) {
    return dbInstance as Client;
  }

  if (useTurso) {
    // Use Turso for Vercel deployment
    dbInstance = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    await initializeTursoSchema(dbInstance as Client);
  } else {
    // Use better-sqlite3 for local development
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const path = await import("path");
    const dbPath = path.join(__dirname, "../../shared-calendar.db");
    const sqliteDb = new BetterSqlite3(dbPath);
    sqliteDb.pragma("foreign_keys = ON");
    initializeSqliteSchema(sqliteDb);

    // Wrap better-sqlite3 to provide Turso-compatible interface
    dbInstance = createSqliteWrapper(sqliteDb);
  }

  isInitialized = true;
  console.log(`✅ Database initialized (${useTurso ? "Turso" : "SQLite"})`);
  return dbInstance as Client;
}

/**
 * Synchronous database access for backwards compatibility (local dev only)
 */
export let db: Database.Database;

// Only initialize synchronously for local development (not on Vercel)
// This block will be skipped entirely on Vercel
function initializeLocalDb() {
  if (useTurso) return;

  try {
    // Dynamic import to avoid loading on Vercel
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const dbPath = path.join(__dirname, "../../shared-calendar.db");
    db = new BetterSqlite3(dbPath);
    db.pragma("foreign_keys = ON");
    initializeSqliteSchema(db);
    console.log("✅ Database initialized (SQLite sync)");
  } catch {
    console.log("⚠️ better-sqlite3 not available, using Turso only");
  }
}

initializeLocalDb();

/**
 * Initialize Turso database schema
 */
async function initializeTursoSchema(client: Client): Promise<void> {
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
}

/**
 * Initialize SQLite database schema (better-sqlite3)
 */
function initializeSqliteSchema(sqliteDb: Database.Database): void {
  sqliteDb.exec(`
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

  try {
    sqliteDb.exec(
      "ALTER TABLE calendar_accounts ADD COLUMN primary_user_id TEXT",
    );
  } catch {
    // Column already exists
  }

  sqliteDb.exec(`
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

  sqliteDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email);
    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id);
    CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email);
    CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id);
  `);
}

/**
 * Create a Turso-compatible wrapper around better-sqlite3
 */
function createSqliteWrapper(sqliteDb: Database.Database): Client {
  return {
    execute: async (
      sql: string | { sql: string; args?: unknown[] },
      args?: unknown[],
    ) => {
      const query = typeof sql === "string" ? sql : sql.sql;
      const params = typeof sql === "string" ? args : sql.args;

      if (params && params.length > 0) {
        const stmt = sqliteDb.prepare(query);
        if (
          query.trim().toUpperCase().startsWith("SELECT") ||
          query.trim().toUpperCase().startsWith("PRAGMA")
        ) {
          const rows = stmt.all(...params);
          return {
            rows,
            columns: [],
            rowsAffected: 0,
            lastInsertRowid: BigInt(0),
          };
        } else {
          const result = stmt.run(...params);
          return {
            rows: [],
            columns: [],
            rowsAffected: result.changes,
            lastInsertRowid: BigInt(result.lastInsertRowid),
          };
        }
      } else {
        const stmt = sqliteDb.prepare(query);
        if (
          query.trim().toUpperCase().startsWith("SELECT") ||
          query.trim().toUpperCase().startsWith("PRAGMA")
        ) {
          const rows = stmt.all();
          return {
            rows,
            columns: [],
            rowsAffected: 0,
            lastInsertRowid: BigInt(0),
          };
        } else {
          const result = stmt.run();
          return {
            rows: [],
            columns: [],
            rowsAffected: result.changes,
            lastInsertRowid: BigInt(result.lastInsertRowid),
          };
        }
      }
    },
    batch: async () => {
      throw new Error("Batch not implemented for SQLite wrapper");
    },
    transaction: async () => {
      throw new Error("Transaction not implemented for SQLite wrapper");
    },
    executeMultiple: async () => {
      throw new Error("executeMultiple not implemented for SQLite wrapper");
    },
    sync: async () => {},
    close: () => {
      sqliteDb.close();
    },
    closed: false,
    protocol: "file" as const,
  } as unknown as Client;
}

export { useTurso };
