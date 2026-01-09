"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.migrate = migrate;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dataDir = node_path_1.default.join(process.cwd(), 'data');
if (!node_fs_1.default.existsSync(dataDir))
    node_fs_1.default.mkdirSync(dataDir, { recursive: true });
exports.db = new better_sqlite3_1.default(node_path_1.default.join(dataDir, 'app.db'));
exports.db.pragma('journal_mode = WAL');
function migrate() {
    exports.db.exec(`
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
