const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const db         = require('../database');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ── REGISTER ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    if (password.length < 6)
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً' });

    const hashed = await bcrypt.hash(password, 10);
    const token  = uuidv4();

    // If email not configured, auto-verify
    const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_email@gmail.com';
    const autoVerify = emailConfigured ? 0 : 1;

    db.prepare('INSERT INTO users (full_name, email, password, verification_token, is_verified) VALUES (?, ?, ?, ?, ?)')
      .run(full_name, email, hashed, token, autoVerify);

    const verifyUrl = `${process.env.BASE_URL}/api/auth/verify/${token}`;
    try {
      if (emailConfigured) {
        await transporter.sendMail({
          from: `"أشبال البساتين فوج قليبية" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'تأكيد البريد الإلكتروني - أشبال البساتين',
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;background:#f0f8ff;padding:28px;border-radius:10px;">
            <h2 style="color:#1a6b5a;">مرحباً ${full_name}!</h2>
            <p>شكراً على تسجيلك في <strong>أشبال البساتين فوج قليبية</strong>.</p>
            <a href="${verifyUrl}" style="background:#c9a227;color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:14px 0;">✅ تأكيد البريد الإلكتروني</a>
          </div>`
        });
      }
    } catch (e) { console.log('Email send skipped:', e.message); }

    if (autoVerify) {
      res.json({ message: 'تم التسجيل بنجاح! يمكنك تسجيل الدخول الآن.', autoVerified: true });
    } else {
      res.json({ message: 'تم التسجيل! تحقق من بريدك الإلكتروني لتفعيل حسابك.' });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── VERIFY EMAIL ──────────────────────────────────────────
router.get('/verify/:token', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE verification_token = ?').get(req.params.token);
  if (!user) return res.redirect('/pages/verified.html?status=invalid');
  db.prepare('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
  res.redirect('/pages/verified.html?status=success');
});

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
    if (!user.is_verified) {
      // Auto-verify if email confirmation not configured
      if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
        db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);
        user.is_verified = 1;
      } else {
        return res.status(403).json({ error: 'يرجى تأكيد بريدك الإلكتروني أولاً', unverified: true });
      }
    }

    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });

    const secret = process.env.JWT_SECRET || 'cubs_kelibia_secret_2024_fallback';
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      secret, { expiresIn: '7d' }
    );
    res.json({ token: jwtToken, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── RESEND VERIFICATION ───────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'البريد غير موجود' });
    if (user.is_verified) return res.status(400).json({ error: 'الحساب مؤكد مسبقاً' });
    const token = uuidv4();
    db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').run(token, user.id);
    const verifyUrl = `${process.env.BASE_URL}/api/auth/verify/${token}`;
    await transporter.sendMail({
      from: `"أشبال البساتين" <${process.env.EMAIL_USER}>`, to: email,
      subject: 'تأكيد البريد الإلكتروني - أشبال البساتين',
      html: `<div dir="rtl" style="padding:20px;font-family:Arial,sans-serif;">
        <a href="${verifyUrl}" style="background:#FFD700;color:#003399;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">✅ تأكيد البريد</a>
      </div>`
    });
    res.json({ message: 'تم إرسال رسالة التأكيد مجدداً' });
  } catch (err) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── PROFILE ───────────────────────────────────────────────
router.get('/profile', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, full_name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ── MIDDLEWARE ────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'غير مصرح' });
  const secret = process.env.JWT_SECRET || 'cubs_kelibia_secret_2024_fallback';
  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ error: 'رمز غير صالح' });
    req.user = user; next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
