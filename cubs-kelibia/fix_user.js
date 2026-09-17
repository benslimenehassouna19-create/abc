const db = require('./database');
db.ready.then(() => {
  // Verify all users and set admin role
  db.prepare('UPDATE users SET is_verified = 1, role = ?').run('admin');
  const users = db.prepare('SELECT id, full_name, email, is_verified, role FROM users').all();
  console.log('✅ All users verified and set to admin:');
  users.forEach(u => console.log(`  - ${u.full_name} | ${u.email} | verified:${u.is_verified} | role:${u.role}`));
  process.exit(0);
});
