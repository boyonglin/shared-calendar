import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'shared-calendar.db');

export const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database initialized');
}

export type CalendarAccount = {
  id: number;
  user_id: string;
  provider: 'google' | 'icloud' | 'outlook';
  external_email: string;
  access_token: string;
  refresh_token: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};
