// Migration to make refresh_token nullable for Outlook support
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "shared-calendar.db");
const db = new Database(DB_PATH);

console.log("Starting migration: Making refresh_token nullable...");

try {
  // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
  db.exec(`
    BEGIN TRANSACTION;

    -- Create new table with correct schema
    CREATE TABLE calendar_accounts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL CHECK(provider IN ('google', 'icloud', 'outlook')),
      external_email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,  -- Now nullable
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Copy data from old table
    INSERT INTO calendar_accounts_new 
      (id, user_id, provider, external_email, access_token, refresh_token, metadata, created_at, updated_at)
    SELECT 
      id, user_id, provider, external_email, access_token, refresh_token, metadata, created_at, updated_at
    FROM calendar_accounts;

    -- Drop old table
    DROP TABLE calendar_accounts;

    -- Rename new table
    ALTER TABLE calendar_accounts_new RENAME TO calendar_accounts;

    -- Recreate indexes
    CREATE INDEX idx_calendar_accounts_user_id ON calendar_accounts(user_id);
    CREATE INDEX idx_calendar_accounts_email ON calendar_accounts(external_email);

    COMMIT;
  `);

  console.log("✅ Migration completed successfully!");
  console.log("refresh_token is now nullable for Outlook support.");
} catch (error) {
  console.error("❌ Migration failed:", error);
  db.exec("ROLLBACK");
  process.exit(1);
}

db.close();
