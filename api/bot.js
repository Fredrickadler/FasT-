const { Telegraf } = require('telegraf');
const express = require('express');
const app = express();

// تنظیمات اصلی
const BOT_TOKEN = process.env.BOT_TOKEN || "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk";
const bot = new Telegraf(BOT_TOKEN);

// Middleware برای خطایابی
bot.use((ctx, next) => {
  console.log('دریافت پیام:', ctx.updateType);
  return next();
});

// دستور start
bot.start((ctx) => {
  try {
    return ctx.reply('ربات با موفقیت فعال شد!');
  } catch (e) {
    console.error('خطا در start:', e);
  }
});

// راه‌اندازی وب‌هوک
app.use(async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('خطای سرور:', err);
    res.status(500).send('خطای داخلی سرور');
  }
});

// تست سلامت
app.get('/', (req, res) => {
  res.send('Bot is running');
});

module.exports = app;