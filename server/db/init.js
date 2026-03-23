import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data.db');

let db;

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'keyword',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT,
      source TEXT NOT NULL,
      source_url TEXT,
      keyword_id INTEGER,
      heat_score INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      ai_analysis TEXT,
      raw_data TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (keyword_id) REFERENCES keywords(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotspot_id INTEGER,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      is_read INTEGER DEFAULT 0,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotspot_id) REFERENCES hotspots(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      keywords_scanned INTEGER DEFAULT 0,
      new_items INTEGER DEFAULT 0,
      web_count INTEGER DEFAULT 0,
      twitter_count INTEGER DEFAULT 0,
      rss_count INTEGER DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 默认设置
  const existing = db.exec("SELECT key FROM settings WHERE key = 'scan_interval'");
  if (existing.length === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('scan_interval', '30')");
    db.run("INSERT INTO settings (key, value) VALUES ('notify_email', '')");
    db.run("INSERT INTO settings (key, value) VALUES ('notify_browser_push', '1')");
    db.run("INSERT INTO settings (key, value) VALUES ('notify_websocket', '1')");
  }

  // Migration: normalize non-ISO published_at dates to ISO format
  try {
    const stmt = db.prepare("SELECT id, published_at FROM hotspots WHERE published_at IS NOT NULL AND published_at NOT LIKE '____-__-__%'");
    const toFix = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        const d = new Date(row.published_at);
        if (!isNaN(d.getTime())) {
          toFix.push({ id: row.id, iso: d.toISOString() });
        }
      } catch { /* skip unparseable */ }
    }
    stmt.free();
    if (toFix.length > 0) {
      for (const { id, iso } of toFix) {
        db.run("UPDATE hotspots SET published_at = ? WHERE id = ?", [iso, id]);
      }
      console.log(`🔧 Migrated ${toFix.length} published_at dates to ISO format`);
    }
  } catch (e) {
    console.error('Date migration error:', e.message);
  }

  saveDatabase();
  console.log('✅ Database initialized');
  return db;
}

export function getDb() {
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

// Helper: run query and return rows as objects
export function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('queryAll error:', err.message, sql);
    return [];
  }
}

export function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (err) {
    console.error('queryOne error:', err.message, sql);
    return null;
  }
}

export function runSql(sql, params = []) {
  db.run(sql, params);
  // Get last inserted row id BEFORE saveDatabase to avoid potential reset
  let lastId = 0;
  try {
    const res = db.exec("SELECT last_insert_rowid()");
    if (res.length > 0 && res[0].values.length > 0) {
      lastId = Number(res[0].values[0][0]);
    }
  } catch (e) { /* ignore */ }
  const changes = db.getRowsModified();
  saveDatabase();
  return { changes, lastId };
}
