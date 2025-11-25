import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "../../shared-calendar.db");
export const db: Database.Database = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database schema
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
  );
`);

// Add primary_user_id column if it doesn't exist (migration for existing databases)
try {
  db.exec(`ALTER TABLE calendar_accounts ADD COLUMN primary_user_id TEXT`);
  console.log("✅ Added primary_user_id column to calendar_accounts");
} catch {
  // Column already exists, ignore
}

// User connections table for friend relationships
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
  );
`);

// Create index for faster lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON user_connections(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email);
  CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id);
`);

console.log("✅ Database initialized");
