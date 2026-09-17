const path = require('path');
const fs   = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'cubs_kelibia.db');

let db;       // sql.js Database instance
let ready;    // promise that resolves when db is ready

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function wrapResult(stmtResult) {
  // sql.js exec() returns [{columns, values}]
  return stmtResult;
}

// ── tiny synchronous-style wrapper so the rest of the code stays the same ──
// sql.js is synchronous internally; we just need an async init.

ready = initSqlJs().then(SQL => {
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      is_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS jalsa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      date TEXT NOT NULL,
      lieu TEXT NOT NULL,
      president TEXT NOT NULL,
      membres_presents TEXT,
      ordre_du_jour TEXT,
      discussions TEXT,
      decisions TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS saderat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      date TEXT NOT NULL,
      destinataire TEXT NOT NULL,
      objet TEXT NOT NULL,
      contenu TEXT,
      statut TEXT DEFAULT 'مُرسَل',
      created_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS weridet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      date TEXT NOT NULL,
      expediteur TEXT NOT NULL,
      objet TEXT NOT NULL,
      contenu TEXT,
      statut TEXT DEFAULT 'مُستَلَم',
      created_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS soudesiyet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance TEXT,
      telephone TEXT,
      adresse TEXT,
      grade TEXT,
      date_adhesion TEXT,
      statut TEXT DEFAULT 'نشط',
      created_by INTEGER,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);
  save();
  console.log('✅ Database ready');
});

// ── Synchronous-style helpers (sql.js is sync after init) ──

function prepare(sql) {
  return {
    // returns first row as plain object, or undefined
    get(...params) {
      const res = db.exec(sql, params);
      if (!res.length || !res[0].values.length) return undefined;
      const { columns, values } = res[0];
      return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
    },
    // returns all rows as array of plain objects
    all(...params) {
      const res = db.exec(sql, params);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    },
    // runs INSERT/UPDATE/DELETE, returns {lastInsertRowid, changes}
    run(...params) {
      db.run(sql, params);
      save();
      const lastInsertRowid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      return { lastInsertRowid };
    }
  };
}

function exec(sql) {
  db.run(sql);
  save();
}

module.exports = { prepare, exec, get ready() { return ready; } };
