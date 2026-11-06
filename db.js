const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('campus.db');

// Allowed tables and their columns
const tables = {
  students: ['name', 'email', 'course', 'year'],
  courses:  ['code', 'title', 'credits', 'faculty'],
  faculty:  ['name', 'email', 'department']
};

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT, course TEXT, year INTEGER
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL, title TEXT NOT NULL, credits INTEGER, faculty TEXT
  );
  CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT, department TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT, status TEXT,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function check(table) {
  if (!tables[table]) throw new Error('Invalid table');
}

function pick(table, data) {
  const values = {};
  tables[table].forEach(c => (values[c] = data[c] ?? null));
  return values;
}

// ---------- CRUD ----------
function getAll(table) {
  check(table);
  return db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
}

function getOne(table, id) {
  check(table);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function create(table, data) {
  check(table);
  const cols = tables[table];
  const sql = `INSERT INTO ${table} (${cols.join(',')})
               VALUES (${cols.map(c => '@' + c).join(',')})`;
  const result = db.prepare(sql).run(pick(table, data));
  return getOne(table, result.lastInsertRowid);
}

function update(table, id, data) {
  check(table);
  const sets = tables[table].map(c => `${c} = @${c}`).join(',');
  db.prepare(`UPDATE ${table} SET ${sets} WHERE id = @id`)
    .run({ ...pick(table, data), id });
  return getOne(table, id);
}

function remove(table, id) {
  check(table);
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
}

// ---------- Login ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}

function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

function registerUser(username, password) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
    .run(username, hashPassword(password));
}

function loginUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const ok = user && checkPassword(password, user.password);

  db.prepare('INSERT INTO login_history (username, status) VALUES (?, ?)')
    .run(username, ok ? 'success' : 'failed');

  if (!ok) return null;
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  return token;
}

function getUserByToken(token) {
  return db.prepare(`
    SELECT users.id, users.username FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?`).get(token);
}

function logout(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getLoginHistory() {
  return db.prepare('SELECT * FROM login_history ORDER BY id DESC LIMIT 50').all();
}

module.exports = {
  getAll, getOne, create, update, remove,
  registerUser, loginUser, getUserByToken, logout, getLoginHistory
};
