const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'jobs.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Initialize the SQLite database (loads from disk if exists, creates fresh if not).
 * sql.js runs entirely in JS — no native compilation needed.
 */
async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Apply schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.run(schema);
  persist(); // save initial state
  console.log('[DB] Schema applied / verified.');

  return db;
}

/**
 * Persist the in-memory database to disk.
 * Call this after any write operation.
 */
function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Run a SELECT and return all rows as plain objects.
 */
function queryAll(sql, params = []) {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Run a SELECT and return the first row (or undefined).
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0];
}

/**
 * Run an INSERT/UPDATE/DELETE statement, persist to disk, and return the db.
 */
function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  db.run(sql, params);
  persist();
  return db;
}

/**
 * Get the initialized db (throws if not yet initialized).
 */
function getDb() {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}

module.exports = { initDb, getDb, queryAll, queryOne, run, persist };
