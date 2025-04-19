const { Telegraf } = require('telegraf');
const { decryptKey } = require('./security');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware برای لاگ فعالیت‌ها
bot.use((ctx, next) => {
  console.log(`پیام از ${ctx.from.id}: ${ctx.message.text}`);
  return next();
});

// مدیریت خطاها
bot.catch((err, ctx) => {
  console.error('خطا در بات:', err);
  ctx.reply('⚠️ خطایی در پردازش درخواست رخ داد');
});

module.exports = { bot };