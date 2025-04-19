const { Telegraf } = require('telegraf');
const express = require('express');
const app = express();

// تنظیمات ربات - اینجا را دقیق پر کنید
const BOT_TOKEN = "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk";
const RECEIVER = "0xYourWalletAddress"; // آدرس ولت مقصد

const bot = new Telegraf(BOT_TOKEN);

// پاسخ به /start
bot.start((ctx) => {
  console.log('دریافت دستور start از:', ctx.from.id);
  ctx.replyWithMarkdownV2(
    `🤖 *ربات انتقال لحظه‌ای فعال شد*\n\n` +
    `🔹 نسخه: 2.0\n` +
    `🔹 سرعت: 0.5 ثانیه\n` +
    `🔹 شبکه‌ها: Ethereum, BSC, Polygon, Base\n\n` +
    `برای شروع از دستور زیر استفاده کنید:\n` +
    `\\/watch [کلیدخصوصی]`
  );
});

// سایر دستورات...
bot.command('watch', (ctx) => {
  ctx.reply('رصد شروع شد!');
});

// راه‌اندازی وب‌هوک
app.use(bot.webhookCallback('/api/bot'));
bot.telegram.setWebhook(`${process.env.VERCEL_URL}/api/bot`);

// تست سلامت
app.get('/', (req, res) => {
  res.send('ربات فعال است!');
});

module.exports = app;