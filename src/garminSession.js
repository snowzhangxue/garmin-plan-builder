const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "garmin-sessions.db");

async function initSessionStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(
    "CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, oauth1 TEXT, oauth2 TEXT)"
  );

  return db;
}

async function getSession(db, key) {
  const row = await db.get(
    "SELECT oauth1, oauth2 FROM sessions WHERE key = ?",
    key
  );
  return row || null;
}

async function saveSession(db, key, session) {
  await db.run(
    "INSERT OR REPLACE INTO sessions (key, oauth1, oauth2) VALUES (?, ?, ?)",
    key,
    session.oauth1,
    session.oauth2
  );
}

async function deleteSession(db, key) {
  await db.run("DELETE FROM sessions WHERE key = ?", key);
}

module.exports = {
  initSessionStore,
  getSession,
  saveSession,
  deleteSession
};
