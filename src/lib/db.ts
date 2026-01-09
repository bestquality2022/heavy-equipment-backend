
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS estimates (
      id TEXT PRIMARY KEY,

      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,

      service TEXT NOT NULL,
      description TEXT,

      status TEXT DEFAULT 'NEW',
      quoted_amount INTEGER,
      admin_notes TEXT,
      scheduled_at TEXT,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estimate_photos (
      id TEXT PRIMARY KEY,
      estimate_id TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      estimate_id TEXT,
      status TEXT DEFAULT 'PENDING',
      eta TEXT,
      lat REAL,
      lng REAL,
      dest_lat REAL,
      dest_lng REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'PENDING',
      provider TEXT DEFAULT 'STRIPE',
      provider_ref TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}