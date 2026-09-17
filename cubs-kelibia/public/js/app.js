/* Cubs Kelibia - app.js */
const API = '/api';

const Auth = {
  getToken: () => localStorage.getItem('ck_token'),
  getUser: () => { try { return JSON.parse(localStorage.getItem('ck_user')); } catch { return null; } },
  set: (token, user) => { localStorage.setItem('ck_token', token); localStorage.setItem('ck_user', JSON.stringify(user)); },
  logout: () => { localStorage.removeItem('ck_token'); localStorage.removeItem('ck_user'); window.location.href = '/pages/login.html'; },
  loggedIn: () => !!localStorage.getItem('ck_token'),
  require: () => { if (!localStorage.getItem('ck_token')) { window.location.href = '/pages/login.html'; return false; } return true; }
};

async function api(url, opts = {}) {
  const token = Auth.getToken();
  const res = await fetch(API + url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) { Auth.logout(); return; }
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = Object.assign(document.createElement('div'), { className: `alert alert-${type}`, innerHTML: `<span>${icons[type]||'ℹ️'}</span> ${msg}` });
  const c = document.getElementById('alerts') || document.body;
  c.prepend(el);
  setTimeout(() => el.remove(), 4200);
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('active'); m.querySelector('form')?.reset(); } }

document.addEventListener('click', e => { if (e.target.classList.contains('modal-ov')) e.target.classList.remove('active'); });

function renderNav() {
  const u = Auth.getUser();
  const el = document.getElementById('nav-user');
  if (el && u) el.innerHTML = `<span class="user-chip"><span class="u-av">${u.full_name.charAt(0)}</span><span>${u.full_name}</span></span>`;
  // active link
  const path = window.location.pathname;
  document.querySelectorAll('.nb-menu a, .sb-nav a').forEach(a => {
    a.classList.toggle('active', !!a.getAttribute('href') && path.endsWith(a.getAttribute('href').replace(/^.*\//, '')));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  document.querySelectorAll('.logout-btn').forEach(b => b.addEventListener('click', e => { e.preventDefault(); Auth.logout(); }));
});
