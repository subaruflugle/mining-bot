const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ⚙️ الإعدادات
const BOT_TOKEN = '8825729089:AAGWOLEVyBnAn2ET1cXsmupsdEY2nNxj_zE';
const WEBAPP_URL = 'https://USERNAME.github.io/mining-bot/'; // ← غيّرها
const PORT = process.env.PORT || 3000;
const MINING_DURATION = 8 * 60 * 60 * 1000; // 8 ساعات
const BASE_REWARD = 1000;

// ===== التخزين =====
const DB_FILE = path.join(__dirname, 'data.json');
let db = { users: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// ===== التحقق من تلجرام =====
function verifyInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculated !== hash) return null;
    return JSON.parse(params.get('user') || '{}');
  } catch { return null; }
}

function getUser(id) {
  if (!db.users[id]) db.users[id] = { balance: 0, startedAt: 0, totalMined: 0 };
  return db.users[id];
}

// ===== API =====
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.send('Mining Bot API is running ✅'));

app.post('/api/state', (req, res) => {
  const user = verifyInitData(req.body.initData);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const u = getUser(user.id);
  res.json({
    balance: u.balance, totalMined: u.totalMined,
    startedAt: u.startedAt, duration: MINING_DURATION, reward: BASE_REWARD,
    name: user.first_name || 'Miner'
  });
});

app.post('/api/start', (req, res) => {
  const user = verifyInitData(req.body.initData);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const u = getUser(user.id);
  if (u.startedAt) return res.status(400).json({ error: 'already mining' });
  u.startedAt = Date.now(); save();
  res.json({ ok: true, startedAt: u.startedAt });
});

app.post('/api/claim', (req, res) => {
  const user = verifyInitData(req.body.initData);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const u = getUser(user.id);
  if (!u.startedAt) return res.status(400).json({ error: 'not mining' });
  if (Date.now() - u.startedAt < MINING_DURATION)
    return res.status(400).json({ error: 'not ready' });
  u.balance += BASE_REWARD;
  u.totalMined += BASE_REWARD;
  u.startedAt = 0; save();
  res.json({ ok: true, balance: u.balance, reward: BASE_REWARD });
});

app.listen(PORT, () => console.log(`✅ API on :${PORT}`));

// ===== البوت =====
const bot = new Telegraf(BOT_TOKEN);
bot.start((ctx) => {
  ctx.reply(
    `أهلاً ${ctx.from.first_name} 👋\n\n⛏️ اضغط الزر تحت عشان تبدأ التعدين السحابي`,
    Markup.keyboard([Markup.button.webApp('⛏️ افتح التطبيق', WEBAPP_URL)]).resize()
  );
});
bot.command('menu', (ctx) => {
  ctx.reply('القائمة:', Markup.inlineKeyboard([
    Markup.button.webApp('🪙 افتح التطبيق', WEBAPP_URL)
  ]));
});
bot.launch();
console.log('✅ Bot is running');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));