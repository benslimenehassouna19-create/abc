const db = require('./database');
db.ready.then(() => {
  // Add file_path to saderat
  try {
    db.prepare("ALTER TABLE saderat ADD COLUMN file_path TEXT DEFAULT ''").run();
    console.log('✅ file_path added to saderat');
  } catch(e) { console.log('ℹ️  saderat.file_path already exists'); }

  // Add file_path to weridet too (same need)
  try {
    db.prepare("ALTER TABLE weridet ADD COLUMN file_path TEXT DEFAULT ''").run();
    console.log('✅ file_path added to weridet');
  } catch(e) { console.log('ℹ️  weridet.file_path already exists'); }

  process.exit(0);
});
