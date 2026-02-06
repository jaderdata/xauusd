const Database = require('better-sqlite3');
const db = new Database('trading.db');

// Create table if not exists (in case app didn't run yet)
db.exec(`
  CREATE TABLE IF NOT EXISTS candles (
    time INTEGER PRIMARY KEY,
    open REAL,
    high REAL,
    low REAL,
    close REAL
  )
`);

// Generate 100 candles
const candles = [];
let price = 2000.0;
let time = Math.floor(Date.now() / 1000) - (100 * 60 * 15); // Start 100 candles ago (M15)

const stmt = db.prepare('INSERT OR REPLACE INTO candles (time, open, high, low, close) VALUES (?, ?, ?, ?, ?)');

const insertMany = db.transaction((data) => {
    for (const c of data) {
        stmt.run(c.time, c.open, c.high, c.low, c.close);
    }
});

for (let i = 0; i < 100; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;

    candles.push({ time, open, high, low, close });

    price = close;
    time += (15 * 60); // +15 mins
}

insertMany(candles);
console.log('Seeded 100 candles into trading.db');
