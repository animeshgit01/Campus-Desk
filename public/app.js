const config = {
  students: ['name', 'email', 'course', 'year'],
  courses:  ['code', 'title', 'credits', 'faculty'],
  faculty:  ['name', 'email', 'department']
};

let current = 'students';
let editId = null;
let rows = [];

const form  = document.getElementById('form');
const thead = document.getElementById('thead');
const tbody = document.getElementById('tbody');
const title = document.getElementById('title');

// Prevent HTML injection
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildForm() {
  title.textContent = (editId ? 'Edit ' : 'Add ') + current;
  form.innerHTML =
    config[current].map(f => `<input name="${f}" placeholder="${f}" required>`).join('') +
    `<button type="submit">${editId ? 'Update' : 'Add'}</button>` +
    (editId ? `<button type="button" class="light" onclick="cancelEdit()">Cancel</button>` : '');
}

async function load() {
  const res = await fetch('/api/' + current);
  if (res.status === 401) return (location.href = '/login.html');
  rows = await res.json();
  const cols = config[current];

  thead.innerHTML =
    '<tr><th>ID</th>' + cols.map(c => `<th>${c}</th>`).join('') + '<th>Actions</th></tr>';

  tbody.innerHTML = rows.map(r =>
    `<tr><td>${r.id}</td>` +
    cols.map(c => `<td>${esc(r[c])}</td>`).join('') +
    `<td>
       <button class="light" onclick="edit(${r.id})">Edit</button>
       <button class="danger" onclick="del(${r.id})">Delete</button>
     </td></tr>`
  ).join('');
}

function edit(id) {
  const row = rows.find(r => r.id === id);
  editId = id;
  buildForm();
  config[current].forEach(f => (form.elements[f].value = row[f] ?? ''));
  window.scrollTo(0, 0);
}

function cancelEdit() {
  editId = null;
  buildForm();
}

async function del(id) {
  if (!confirm('Delete this record?')) return;
  await fetch(`/api/${current}/${id}`, { method: 'DELETE' });
  load();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const url = editId ? `/api/${current}/${editId}` : `/api/${current}`;

  await fetch(url, {
    method: editId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  editId = null;
  buildForm();
  load();
});

// Tab switching
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.tab.active').classList.remove('active');
    btn.classList.add('active');
    current = btn.dataset.table;
    editId = null;
    buildForm();
    load();
  });
});

// Show username, redirect if not logged in
fetch('/auth/me')
  .then(r => (r.ok ? r.json() : (location.href = '/login.html')))
  .then(u => u && (document.getElementById('user').textContent = u.username));

document.getElementById('logout').onclick = async () => {
  await fetch('/auth/logout', { method: 'POST' });
  location.href = '/login.html';
};

buildForm();
load();
