const { Telegraf } = require('telegraf');
const express = require('express');
const app = express();

// تنظیمات اصلی (این مقادیر را دقیقاً وارد کنید)
const config = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk", // توکن ربات شما
  VERCEL_URL: "https://fas-t.vercel.app" // آدرس پروژه شما در Vercel
};

const bot = new Telegraf(config.BOT_TOKEN);

// Middleware برای لاگ کردن خطاها
bot.use(async (ctx, next) => {
  try {
    console.log('پیام دریافت شد:', ctx.message?.text);
    await next();
  } catch (err) {
    console.error('خطا در پردازش پیام:', err);
  }
});

// دستور start
bot.start((ctx) => {
  console.log('دستور start دریافت شد');
  ctx.replyWithHTML(
    '<b>ربات فعال شد!</b>\n\n' +
    '✅ اتصال به سرور موفقیت‌آمیز بود\n' +
    '🔄 برای شروع از /watch استفاده کنید'
  );
});

// راه‌اندازی وب‌هوک
app.use(express.json());
app.post(`/api/telegram`, async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
    res.status(200).send('OK');
  } catch (err) {
    console.error('خطا در وب‌هوک:', err);
    res.status(500).send('خطای سرور');
  }
});

// تست سلامت
app.get('/', (req, res) => {
  res.send('ربات تلگرام در حال اجراست');
});

// تنظیم خودکار وب‌هوک هنگام استقرار
if (process.env.VERCEL) {
  (async () => {
    try {
      await bot.telegram.setWebhook(`${config.VERCEL_URL}/api/telegram`);
      console.log('وب‌هوک با موفقیت تنظیم شد');
    } catch (err) {
      console.error('خطا در تنظیم وب‌هوک:', err);
    }
  })();
}

module.exports = app;