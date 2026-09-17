const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../database');
const { authenticateToken } = require('./auth');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

// ── File upload config ──────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    cb(null, `saderat_${Date.now()}_${base}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('فقط ملفات PDF أو Word مسموح بها'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB max

// ── ROUTES ──────────────────────────────────────────────

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(
    'SELECT s.*, u.full_name as creator FROM saderat s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.created_at DESC'
  ).all());
});

router.get('/:id', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM saderat WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  res.json(row);
});

// CREATE — accepts multipart/form-data for file upload
router.post('/', authenticateToken, upload.single('attached_file'), (req, res) => {
  const { numero, date, destinataire, objet, contenu, statut } = req.body;
  if (!numero || !date || !destinataire || !objet)
    return res.status(400).json({ error: 'الحقول الأساسية مطلوبة' });

  const file_path = req.file ? '/uploads/' + req.file.filename : '';

  const r = db.prepare(
    'INSERT INTO saderat (numero, date, destinataire, objet, contenu, statut, file_path, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(numero, date, destinataire, objet, contenu || '', statut || 'مُرسَل', file_path, req.user.id);

  res.json({ id: r.lastInsertRowid, message: 'تم إنشاء الصادر بنجاح' });
});

// UPDATE — also accepts file
router.put('/:id', authenticateToken, upload.single('attached_file'), (req, res) => {
  const { numero, date, destinataire, objet, contenu, statut } = req.body;
  const existing = db.prepare('SELECT file_path FROM saderat WHERE id = ?').get(req.params.id);

  let file_path = existing?.file_path || '';
  if (req.file) {
    // Delete old file if exists
    if (existing?.file_path) {
      const oldPath = path.join(__dirname, '..', 'public', existing.file_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    file_path = '/uploads/' + req.file.filename;
  }

  db.prepare(
    'UPDATE saderat SET numero=?, date=?, destinataire=?, objet=?, contenu=?, statut=?, file_path=? WHERE id=?'
  ).run(numero, date, destinataire, objet, contenu || '', statut, file_path, req.params.id);

  res.json({ message: 'تم التحديث بنجاح' });
});

// DELETE FILE only
router.delete('/:id/file', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT file_path FROM saderat WHERE id = ?').get(req.params.id);
  if (row?.file_path) {
    const full = path.join(__dirname, '..', 'public', row.file_path);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    db.prepare("UPDATE saderat SET file_path = '' WHERE id = ?").run(req.params.id);
  }
  res.json({ message: 'تم حذف الملف' });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT file_path FROM saderat WHERE id = ?').get(req.params.id);
  if (row?.file_path) {
    const full = path.join(__dirname, '..', 'public', row.file_path);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
  db.prepare('DELETE FROM saderat WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف بنجاح' });
});

// ── EXPORT PDF ────────────────────────────────────────────
router.get('/:id/export/pdf', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM saderat WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="saderat_${row.numero}.pdf"`);
  doc.pipe(res);
  doc.rect(0, 0, doc.page.width, 110).fill('#1a6b5a');
  doc.fillColor('#c9a227').fontSize(17).text('فرقة أشبال البساتين فوج قليبية', 50, 22, { align: 'center' });
  doc.fillColor('#FFFFFF').fontSize(13).text('وثيقة صادر', 50, 52, { align: 'center' });
  doc.fillColor('#c9a227').fontSize(10).text(`رقم: ${row.numero}   |   التاريخ: ${row.date}`, 50, 78, { align: 'center' });
  doc.moveDown(3);
  const f = (l, v) => { doc.fontSize(11).fillColor('#1a6b5a').text(l + ': ', { continued: true }).fillColor('#222').text(v || '-'); doc.moveDown(0.4); };
  f('المُرسَل إليه', row.destinataire); f('الموضوع', row.objet); f('الحالة', row.statut);
  if (row.contenu) {
    doc.moveDown(0.5); const y = doc.y;
    doc.rect(50, y, doc.page.width - 100, 22).fill('#1a6b5a');
    doc.fillColor('#c9a227').fontSize(12).text('المحتوى', 50, y + 5, { align: 'center', width: doc.page.width - 100 });
    doc.moveDown(0.5); doc.fillColor('#333').fontSize(10).text(row.contenu, { align: 'right' });
  }
  if (row.file_path) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#1a6b5a').text('📎 ملف مرفق: ', { continued: true }).fillColor('#555').text(path.basename(row.file_path));
  }
  doc.moveDown(2); doc.fontSize(8).fillColor('#aaa').text(`Cubs Kelibia — ${new Date().toLocaleDateString('fr-TN')}`, { align: 'center' });
  doc.end();
});

// ── EXPORT WORD ───────────────────────────────────────────
router.get('/:id/export/word', authenticateToken, async (req, res) => {
  const row = db.prepare('SELECT * FROM saderat WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  const wordDoc = new Document({ sections: [{ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'فرقة أشبال البساتين فوج قليبية', bold: true, size: 36, color: '1a6b5a' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `وثيقة صادر رقم: ${row.numero}`, bold: true, size: 28, color: 'b8860b' })] }),
    new Paragraph({ text: '' }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'رقم الصادر', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.numero || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'التاريخ', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.date || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'المُرسَل إليه', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.destinataire || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'الموضوع', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.objet || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'الحالة', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.statut || '')] })] }),
    ]}),
    new Paragraph({ text: '' }),
    ...(row.contenu ? [
      new Paragraph({ children: [new TextRun({ text: 'المحتوى', bold: true, size: 24, color: '1a6b5a' })] }),
      new Paragraph(row.contenu)
    ] : []),
    ...(row.file_path ? [
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: `📎 ملف مرفق: ${path.basename(row.file_path)}`, size: 20, color: '555555' })] })
    ] : [])
  ]}]});
  const buffer = await Packer.toBuffer(wordDoc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="saderat_${row.numero}.docx"`);
  res.send(buffer);
});

module.exports = router;
