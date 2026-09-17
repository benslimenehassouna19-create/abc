const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { authenticateToken } = require('./auth');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

router.get('/', authenticateToken, (req, res) => {
  res.json(db.prepare(
    'SELECT j.*, u.full_name as creator FROM jalsa j LEFT JOIN users u ON j.created_by = u.id ORDER BY j.created_at DESC'
  ).all());
});

router.get('/:id', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM jalsa WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  res.json(row);
});

router.post('/', authenticateToken, (req, res) => {
  const { numero, date, lieu, president, membres_presents, ordre_du_jour, discussions, decisions } = req.body;
  if (!numero || !date || !lieu || !president)
    return res.status(400).json({ error: 'الحقول الأساسية مطلوبة' });
  const r = db.prepare(
    'INSERT INTO jalsa (numero, date, lieu, president, membres_presents, ordre_du_jour, discussions, decisions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(numero, date, lieu, president, membres_presents || '', ordre_du_jour || '', discussions || '', decisions || '', req.user.id);
  res.json({ id: r.lastInsertRowid, message: 'تم إنشاء محضر الجلسة بنجاح' });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { numero, date, lieu, president, membres_presents, ordre_du_jour, discussions, decisions } = req.body;
  db.prepare(
    'UPDATE jalsa SET numero=?, date=?, lieu=?, president=?, membres_presents=?, ordre_du_jour=?, discussions=?, decisions=? WHERE id=?'
  ).run(numero, date, lieu, president, membres_presents || '', ordre_du_jour || '', discussions || '', decisions || '', req.params.id);
  res.json({ message: 'تم التحديث بنجاح' });
});

router.delete('/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM jalsa WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف بنجاح' });
});

// ── EXPORT PDF ────────────────────────────────────────────
router.get('/:id/export/pdf', authenticateToken, (req, res) => {
  const row = db.prepare('SELECT * FROM jalsa WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="jalsa_${row.numero}.pdf"`);
  doc.pipe(res);

  // Header bar
  doc.rect(0, 0, doc.page.width, 110).fill('#003399');
  doc.fillColor('#FFD700').fontSize(17).text('فرقة أشبال البساتين فوج قليبية', 50, 22, { align: 'center' });
  doc.fillColor('#FFFFFF').fontSize(13).text('محضر الجلسة', 50, 52, { align: 'center' });
  doc.fillColor('#FFD700').fontSize(10).text(`رقم: ${row.numero}   |   التاريخ: ${row.date}`, 50, 78, { align: 'center' });

  doc.moveDown(3);
  const field = (lbl, val) => {
    doc.fontSize(11).fillColor('#003399').text(lbl + ': ', { continued: true }).fillColor('#222').text(val || '-');
    doc.moveDown(0.4);
  };
  field('المكان', row.lieu);
  field('رئيس الجلسة', row.president);
  doc.moveDown(0.5);

  const section = (title, content) => {
    if (!content) return;
    const y = doc.y;
    doc.rect(50, y, doc.page.width - 100, 22).fill('#003399');
    doc.fillColor('#FFD700').fontSize(12).text(title, 50, y + 5, { align: 'center', width: doc.page.width - 100 });
    doc.moveDown(0.5);
    doc.fillColor('#333').fontSize(10).text(content, { align: 'right' });
    doc.moveDown(1);
  };
  section('الأعضاء الحاضرون', row.membres_presents);
  section('جدول الأعمال', row.ordre_du_jour);
  section('المناقشات', row.discussions);
  section('القرارات', row.decisions);

  doc.fontSize(8).fillColor('#aaa').text(`Cubs Kelibia — ${new Date().toLocaleDateString('fr-TN')}`, { align: 'center' });
  doc.end();
});

// ── EXPORT WORD ───────────────────────────────────────────
router.get('/:id/export/word', authenticateToken, async (req, res) => {
  const row = db.prepare('SELECT * FROM jalsa WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });

  const sec = (title, content) => content ? [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 24, color: '003399' })] }),
    new Paragraph({ children: [new TextRun({ text: content, size: 22 })] }),
    new Paragraph({ text: '' })
  ] : [];

  const wordDoc = new Document({ sections: [{ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'فرقة أشبال البساتين فوج قليبية', bold: true, size: 36, color: '003399' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `محضر الجلسة رقم: ${row.numero}`, bold: true, size: 28, color: 'b8860b' })] }),
    new Paragraph({ text: '' }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'رقم الجلسة', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.numero || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'التاريخ', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.date || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'المكان', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.lieu || '')] })] }),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'الرئيس', bold: true })] })] }), new TableCell({ children: [new Paragraph(row.president || '')] })] }),
    ]}),
    new Paragraph({ text: '' }),
    ...sec('الأعضاء الحاضرون', row.membres_presents),
    ...sec('جدول الأعمال', row.ordre_du_jour),
    ...sec('المناقشات', row.discussions),
    ...sec('القرارات', row.decisions),
    new Paragraph({ children: [new TextRun({ text: `تاريخ الإنشاء: ${new Date().toLocaleDateString('fr-TN')}`, size: 18, color: '999999' })] })
  ]}]});

  const buffer = await Packer.toBuffer(wordDoc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="jalsa_${row.numero}.docx"`);
  res.send(buffer);
});

module.exports = router;
