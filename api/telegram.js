const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const express = require('express');
const app = express();

// تنظیمات اصلی
const config = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk",
  VERCEL_URL: "https://fas-t.vercel.app",
  SCAN_INTERVAL: 50, // 0.5 ثانیه
  NETWORKS: {
    polygon: {
      rpc: 'https://polygon-rpc.com',
      chainId: 137,
      symbol: 'MATIC',
      scanner: 'https://polygonscan.com/tx/'
    }
  }
};

const bot = new Telegraf(config.BOT_TOKEN);
const activeWatches = new Map();

// تابع انتقال با گزارش لحظه‌ای
async function processTransfer(userId, privateKey, receiver) {
  const network = 'polygon'; // فقط Polygon در این مثال
  const web3 = new Web3(config.NETWORKS[network].rpc);
  
  try {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const balance = await web3.eth.getBalance(account.address);
    
    if (balance > 0) {
      const amount = web3.utils.fromWei(balance, 'ether');
      
      // گزارش شروع انتقال
      await bot.telegram.sendMessage(
        userId,
        `🔍 موجودی جدید شناسایی شد!\n` +
        `📌 شبکه: ${network}\n` +
        `💰 مقدار: ${amount} ${config.NETWORKS[network].symbol}\n` +
        `⏳ در حال انتقال...`
      );

      const tx = {
        from: account.address,
        to: receiver,
        value: balance,
        gas: 21000,
        gasPrice: await web3.eth.getGasPrice(),
        chainId: config.NETWORKS[network].chainId
      };

      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      // گزارش موفقیت
      await bot.telegram.sendMessage(
        userId,
        `✅ انتقال با موفقیت انجام شد!\n\n` +
        `📌 شبکه: ${network}\n` +
        `💰 مقدار: ${amount} ${config.NETWORKS[network].symbol}\n` +
        `🔗 پیوند تراکنش: ${config.NETWORKS[network].scanner}${receipt.transactionHash}\n` +
        `🆔 هش تراکنش: <code>${receipt.transactionHash}</code>`,
        { parse_mode: 'HTML' }
      );
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('خطا در انتقال:', error);
    await bot.telegram.sendMessage(
      userId,
      `❌ خطا در انتقال:\n<code>${error.message}</code>`,
      { parse_mode: 'HTML' }
    );
    return false;
  }
}

// حلقه رصد با سرعت نیم ثانیه
function startWatching(userId, privateKey, receiver) {
  if (activeWatches.has(userId)) {
    return bot.telegram.sendMessage(userId, '⚠️ رصد از قبل فعال است');
  }

  // گزارش شروع رصد
  bot.telegram.sendMessage(
    userId,
    `🔔 رصد لحظه‌ای فعال شد!\n\n` +
    `⏱️ چک هر ${config.SCAN_INTERVAL/1000} ثانیه\n` +
    `📌 شبکه: Polygon\n` +
    `📤 گیرنده: <code>${receiver}</code>\n\n` +
    `✅ هر موجودی جدید به صورت خودکار انتقال داده خواهد شد`,
    { parse_mode: 'HTML' }
  );

  const interval = setInterval(async () => {
    try {
      await processTransfer(userId, privateKey, receiver);
    } catch (err) {
      console.error('خطا در رصد:', err);
    }
  }, config.SCAN_INTERVAL);

  activeWatches.set(userId, { interval, privateKey, receiver });
}

// دستورات ربات
bot.start((ctx) => {
  ctx.replyWithHTML(
    '🤖 <b>ربات انتقال لحظه‌ای Polygon</b>\n\n' +
    '⚡ سرعت انتقال: <b>0.5 ثانیه</b>\n\n' +
    '📌 <i>برای شروع از دستور زیر استفاده کنید:</i>\n' +
    '<code>/watch [کلیدخصوصی] [آدرس گیرنده]</code>'
  );
});

bot.command('watch', (ctx) => {
  const [_, privateKey, receiver] = ctx.message.text.split(' ');
  
  if (!privateKey || !receiver) {
    return ctx.replyWithHTML(
      '⚠️ <b>فرمت صحیح:</b>\n' +
      '<code>/watch [کلیدخصوصی] [آدرس گیرنده]</code>\n\n' +
      'مثال:\n' +
      '<code>/watch abc123... 0x1734481e8A0f159FBEd3e737Fd2FB2182f6b6775</code>'
    );
  }

  startWatching(ctx.from.id, privateKey, receiver);
});

bot.command('stop', (ctx) => {
  if (activeWatches.has(ctx.from.id)) {
    clearInterval(activeWatches.get(ctx.from.id).interval);
    activeWatches.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  } else {
    ctx.reply('⚠️ هیچ رصد فعالی وجود ندارد');
  }
});

// راه‌اندازی وب‌هوک
app.use(express.json());
app.post('/api/telegram', (req, res) => {
  bot.handleUpdate(req.body, res);
});

// صفحه تست سلامت
app.get('/', (req, res) => {
  res.send('🤖 ربات انتقال لحظه‌ای فعال است');
});

// تنظیم خودکار وب‌هوک
if (process.env.VERCEL) {
  bot.telegram.setWebhook(`${config.VERCEL_URL}/api/telegram`)
    .then(() => console.log('✅ وب‌هوک تنظیم شد'))
    .catch(err => console.error('❌ خطا در وب‌هوک:', err));
}

module.exports = app;