const Database = require('better-sqlite3');
const db = new Database('trading.db');

db.exec('DELETE FROM candles');
db.exec('DELETE FROM trades');

console.log('Database cleared. Ready for REAL MT5 data.');
