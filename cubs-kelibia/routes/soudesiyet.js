const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { authenticateToken } = require('./auth');

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM soudesiyet ORDER BY created_at DESC').all());
});

router.get('/stats', authenticateToken, (req, res) => {
  const total  = db.prepare('SELECT COUNT(*) as c FROM soudesiyet').get()?.c ?? 0;
  const active = db.prepare("SELECT COUNT(*) as c FROM soudesiyet WHERE statut='نشط'").get()?.c ?? 0;
  res.json({ total, active });
});

router.get('/:id', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM soudesiyet WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  res.json(row);
});

router.post('/', authenticateToken, (req, res) => {
  const { nom, prenom, date_naissance, telephone, adresse, grade, date_adhesion, statut, sdasi } = req.body;
  if (!nom || !prenom) return res.status(400).json({ error: 'اللقب والاسم مطلوبان' });
  const r = db.prepare(
    'INSERT INTO soudesiyet (nom, prenom, date_naissance, telephone, adresse, grade, date_adhesion, statut, sdasi, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(nom, prenom, date_naissance||'', telephone||'', adresse||'', grade||'', date_adhesion||'', statut||'نشط', sdasi||'', req.user.id);
  res.json({ id: r.lastInsertRowid, message: 'تم إضافة العضو بنجاح' });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { nom, prenom, date_naissance, telephone, adresse, grade, date_adhesion, statut, sdasi } = req.body;
  db.prepare('UPDATE soudesiyet SET nom=?, prenom=?, date_naissance=?, telephone=?, adresse=?, grade=?, date_adhesion=?, statut=?, sdasi=? WHERE id=?')
    .run(nom, prenom, date_naissance||'', telephone||'', adresse||'', grade||'', date_adhesion||'', statut, sdasi||'', req.params.id);
  res.json({ message: 'تم التحديث بنجاح' });
});

router.delete('/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM soudesiyet WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف بنجاح' });
});

module.exports = router;
