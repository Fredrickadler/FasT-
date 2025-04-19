const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const express = require('express');
const app = express();

// تنظیمات اصلی (تغییر دهید)
const config = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk", // توکن شما
  VERCEL_URL: "https://fas-t.vercel.app", // آدرس پروژه
  SCAN_INTERVAL: 50 // 0.5 ثانیه
};

const bot = new Telegraf(config.BOT_TOKEN);
const activeUsers = new Map();

// تابع انتقال
async function transferFunds(userId, privateKey, receiver) {
  try {
    const web3 = new Web3('https://polygon-rpc.com');
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const balance = await web3.eth.getBalance(account.address);
    
    if (balance > 0) {
      const amount = web3.utils.fromWei(balance, 'ether');
      await bot.telegram.sendMessage(userId, `🔍 ${amount} MATIC یافت شد! در حال انتقال...`);
      
      const tx = {
        from: account.address,
        to: receiver,
        value: balance,
        gas: 21000,
        gasPrice: await web3.eth.getGasPrice(),
        chainId: 137
      };
      
      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      await bot.telegram.sendMessage(userId, `✅ انتقال موفق!\nTxHash: ${receipt.transactionHash}`);
    }
  } catch (error) {
    await bot.telegram.sendMessage(userId, `❌ خطا: ${error.message}`);
  }
}

// دستورات ربات
bot.start((ctx) => ctx.reply('🤖 ربات فعال است! از /watch استفاده کنید'));

bot.command('watch', (ctx) => {
  const [_, privateKey, receiver] = ctx.message.text.split(' ');
  
  if (!privateKey || !receiver) {
    return ctx.reply('⚠️ فرمت صحیح:\n/watch [کلیدخصوصی] [آدرس گیرنده]');
  }
  
  // شروع رصد
  const interval = setInterval(() => {
    transferFunds(ctx.from.id, privateKey, receiver);
  }, config.SCAN_INTERVAL);
  
  activeUsers.set(ctx.from.id, { interval });
  ctx.reply('✅ رصد شروع شد! هر 0.5 ثانیه چک می‌کنم...');
});

bot.command('stop', (ctx) => {
  if (activeUsers.has(ctx.from.id)) {
    clearInterval(activeUsers.get(ctx.from.id).interval);
    activeUsers.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  }
});

// وب‌هوک
app.use(express.json());
app.post('/api/telegram', (req, res) => {
  bot.handleUpdate(req.body, res);
});

// تست سلامت
app.get('/', (req, res) => res.send('Bot is alive!'));

// تنظیم خودکار وب‌هوک
if (process.env.VERCEL) {
  bot.telegram.setWebhook(`${config.VERCEL_URL}/api/telegram`)
    .then(() => console.log('✅ وب‌هوک تنظیم شد'))
    .catch(err => console.error('❌ خطای وب‌هوک:', err));
}

module.exports = app;