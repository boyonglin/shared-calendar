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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log("✅ Database initialized");
