const db = require('./database');
const bcrypt = require('bcryptjs');

db.ready.then(async () => {
  const email = 'benslimenehassouna19@gmail.com';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user) {
    console.log('❌ المستخدم غير موجود في قاعدة البيانات');
    process.exit(1);
  }

  console.log('✅ المستخدم موجود:');
  console.log('   الاسم:', user.full_name);
  console.log('   البريد:', user.email);
  console.log('   مفعّل:', user.is_verified === 1 ? 'نعم ✅' : 'لا ❌');
  console.log('   الدور:', user.role);
  console.log('   كلمة المرور محفوظة:', user.password ? 'نعم ✅' : 'لا ❌');

  // Test password
  const testPasswords = ['123456', '12345678', 'admin', 'password', '00000000'];
  console.log('\n🔑 اختبار كلمات مرور شائعة...');
  for (const pass of testPasswords) {
    const ok = await bcrypt.compare(pass, user.password);
    if (ok) console.log(`   ✅ كلمة المرور: "${pass}"`);
  }

  // Fix: force verify
  db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?').run(email);
  console.log('\n✅ تم تفعيل الحساب مجدداً');

  process.exit(0);
});
