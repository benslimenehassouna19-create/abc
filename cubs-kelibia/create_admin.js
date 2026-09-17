const db = require('./database');
const bcrypt = require('bcryptjs');

db.ready.then(async () => {
  const password = 'admin123';
  const hashed = await bcrypt.hash(password, 10);

  const accounts = [
    { email: 'benslimenehassouna19@gmail.com', name: 'hassouna ben slimene' },
    { email: 'hbenslimene8@gmail.com', name: 'hassouna ben slimene' }
  ];

  for (const acc of accounts) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(acc.email);
    if (existing) {
      db.prepare('UPDATE users SET password = ?, is_verified = 1, role = ? WHERE email = ?')
        .run(hashed, 'admin', acc.email);
      console.log(`✅ حُدِّث: ${acc.email}`);
    } else {
      db.prepare('INSERT INTO users (full_name, email, password, is_verified, role) VALUES (?, ?, ?, 1, ?)')
        .run(acc.name, acc.email, hashed, 'admin');
      console.log(`✅ أُنشئ: ${acc.email}`);
    }
  }

  console.log('\n🔑 بيانات الدخول لكل الحسابات:');
  console.log('   كلمة المرور: admin123');
  
  const all = db.prepare('SELECT email, is_verified, role FROM users').all();
  console.log('\n📋 كل الحسابات:');
  all.forEach(u => console.log(`   ${u.email} | verified:${u.is_verified} | ${u.role}`));

  process.exit(0);
});
