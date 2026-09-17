require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/jalsa',      require('./routes/jalsa'));
app.use('/api/saderat',    require('./routes/saderat'));
app.use('/api/weridet',    require('./routes/weridet'));
app.use('/api/soudesiyet', require('./routes/soudesiyet'));

app.get('*', (req, res) => {
  // let the frontend handle unknown routes from the public folder
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Wait for DB to initialise before accepting connections
const db = require('./database');
db.ready.then(() => {
  app.listen(PORT, () => {
    console.log(`\n🦁  أشبال البساتين فوج قليبية`);
    console.log(`✅  Server running at: http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('❌ Failed to start DB:', err);
  process.exit(1);
});
