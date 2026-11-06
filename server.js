const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

function getToken(req) {
  const m = (req.headers.cookie || '').match(/token=([a-f0-9]+)/);
  return m ? m[1] : null;
}

function requireLogin(req, res, next) {
  if (db.getUserByToken(getToken(req))) return next();
  res.status(401).json({ error: 'Login required' });
}

// Home page only if logged in
app.get('/', (req, res, next) =>
  db.getUserByToken(getToken(req)) ? next() : res.redirect('/login.html'));

app.use(express.static('public'));

// ---------- Login routes ----------
app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6)
    return res.status(400).json({ error: 'Username and password (min 6 characters) required' });
  try {
    db.registerUser(username.trim(), password);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Username already taken' });
  }
});

app.post('/auth/login', (req, res) => {
  const token = db.loginUser(req.body.username, req.body.password);
  if (!token) return res.status(401).json({ error: 'Wrong username or password' });
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; SameSite=Strict`);
  res.json({ ok: true });
});

app.post('/auth/logout', (req, res) => {
  db.logout(getToken(req));
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/auth/me', (req, res) => {
  const user = db.getUserByToken(getToken(req));
  user ? res.json(user) : res.status(401).json({ error: 'Not logged in' });
});

app.get('/auth/history', requireLogin, (req, res) => res.json(db.getLoginHistory()));

// ---------- CRUD routes (protected) ----------
app.use('/api', requireLogin);

const run = fn => (req, res) => {
  try {
    res.json(fn(req));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

app.get('/api/:table',        run(req => db.getAll(req.params.table)));
app.get('/api/:table/:id',    run(req => db.getOne(req.params.table, req.params.id)));
app.post('/api/:table',       run(req => db.create(req.params.table, req.body)));
app.put('/api/:table/:id',    run(req => db.update(req.params.table, req.params.id, req.body)));
app.delete('/api/:table/:id', run(req => ({ deleted: db.remove(req.params.table, req.params.id) })));

// Hosting platforms give the port through PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on port ' + PORT));
