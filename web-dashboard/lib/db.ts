import Database from 'better-sqlite3';
import path from 'path';

// Singleton for Next.js to avoid multiple connections in Dev mode
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof Database> | undefined;
};

const dbPath = path.join(process.cwd(), 'trading.db');

const db = globalForDb.db ?? new Database(dbPath, { verbose: console.log });

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      symbol TEXT,
      side TEXT,
      price REAL,
      vol REAL,
      comment TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS candles (
      time INTEGER,
      timeframe TEXT,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      PRIMARY KEY (time, timeframe)
    );
  `);
}

export default db;
