const db = require('./database');
db.ready.then(() => {
  try {
    db.prepare("ALTER TABLE soudesiyet ADD COLUMN sdasi TEXT DEFAULT ''").run();
    console.log('✅ عمود sdasi أُضيف');
  } catch(e) {
    console.log('ℹ️  العمود موجود مسبقاً');
  }
  process.exit(0);
});
