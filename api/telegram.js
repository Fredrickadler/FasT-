const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const express = require('express');
const app = express();

// تنظیمات
const config = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk",
  RPC_URL: "https://polygon.llamarpc.com", // RPC جایگزین پرسرعت
  SCAN_INTERVAL: 300 // 0.3 ثانیه!
};

const bot = new Telegraf(config.BOT_TOKEN);
const web3 = new Web3(config.RPC_URL);
const activeWallets = new Map();

// تابع انتقال فوق‌سریع
async function instantTransfer(userId, pKey, receiver) {
  try {
    const account = web3.eth.accounts.privateKeyToAccount(pKey);
    const balance = await web3.eth.getBalance(account.address);
    
    if (balance > 0) {
      const amount = web3.utils.fromWei(balance, 'ether');
      await bot.telegram.sendMessage(userId, `⚡ شناسایی ${amount} MATIC!`);
      
      const tx = {
        from: account.address,
        to: receiver,
        value: balance,
        gas: 21000,
        gasPrice: Math.floor(await web3.eth.getGasPrice() * 1.2), // 20% بیشتر برای اطمینان
        chainId: 137
      };

      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      await bot.telegram.sendMessage(userId,
        `✅ انتقال موفق!\n` +
        `📌 Amount: ${amount} MATIC\n` +
        `🔗 Tx: https://polygonscan.com/tx/${receipt.transactionHash}`,
        { disable_web_page_preview: true }
      );
    }
  } catch (error) {
    await bot.telegram.sendMessage(userId, `❌ Error: ${error.message}`);
  }
}

// رصد لحظه‌ای
bot.command('watch', (ctx) => {
  const [_, pKey, receiver] = ctx.message.text.split(' ');
  
  if (!pKey || !receiver) {
    return ctx.reply('⚠️ Format: /watch PRIVATE_KEY RECEIVER_ADDRESS');
  }

  // توقف رصد قبلی (اگر存在)
  if (activeWallets.has(ctx.from.id)) {
    clearInterval(activeWallets.get(ctx.from.id));
  }

  // شروع رصد جدید (هر 0.3 ثانیه)
  const interval = setInterval(() => {
    instantTransfer(ctx.from.id, pKey, receiver);
  }, config.SCAN_INTERVAL);

  activeWallets.set(ctx.from.id, interval);
  ctx.reply(`🔍 Monitoring started! (Every 0.3s)`);
});

// راه‌اندازی
app.use(express.json());
app.post('/api/telegram', (req, res) => {
  bot.handleUpdate(req.body, res);
});
app.get('/', (req, res) => res.send('Bot Active'));

// تنظیم وب‌هوک
if (process.env.VERCEL) {
  bot.telegram.setWebhook(`${process.env.VERCEL_URL}/api/telegram`);
}

module.exports = app;