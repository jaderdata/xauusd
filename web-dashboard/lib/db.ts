import Database from 'better-sqlite3';
import path from 'path';

// Create DB connection
// This creates a file 'trading.db' in the root of the project
const db = new Database('trading.db');

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
    )
  `);
}

export default db;
