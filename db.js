const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT,
      ip TEXT,
      path TEXT,
      reason TEXT
    )
  `);
});

module.exports = db;
