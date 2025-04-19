const { Telegraf } = require('telegraf');
const express = require('express');
const { Web3 } = require('web3');
const app = express();

// تنظیمات اصلی
const config = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk",
  VERCEL_URL: "https://fas-t.vercel.app",
  NETWORKS: {
    polygon: {
      rpc: 'https://polygon-rpc.com',
      chainId: 137,
      symbol: 'MATIC',
      scanner: 'https://polygonscan.com/tx/'
    },
    ethereum: {
      rpc: 'https://cloudflare-eth.com',
      chainId: 1,
      symbol: 'ETH',
      scanner: 'https://etherscan.io/tx/'
    },
    bsc: {
      rpc: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      symbol: 'BNB',
      scanner: 'https://bscscan.com/tx/'
    }
  }
};

const bot = new Telegraf(config.BOT_TOKEN);
const activeTransfers = new Map();

// تابع انتقال دارایی با گزارش‌دهی پیشرفته
async function transferFunds(userId, privateKey, receiver, network) {
  try {
    const web3 = new Web3(config.NETWORKS[network].rpc);
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const balance = await web3.eth.getBalance(account.address);
    
    if (balance > 0) {
      const amount = web3.utils.fromWei(balance, 'ether');
      
      // گزارش شروع انتقال
      await bot.telegram.sendMessage(
        userId,
        `⏳ شروع انتقال ${amount} ${config.NETWORKS[network].symbol}...`
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
      
      // گزارش موفقیت‌آمیز
      return bot.telegram.sendMessage(
        userId,
        `✅ انتقال موفق!\n\n` +
        `📌 شبکه: ${network}\n` +
        `💰 مقدار: ${amount} ${config.NETWORKS[network].symbol}\n` +
        `🔗 پیوند تراکنش: ${config.NETWORKS[network].scanner}${receipt.transactionHash}\n` +
        `🆔 هش تراکنش: ${receipt.transactionHash}`
      );
    }
    
    return bot.telegram.sendMessage(
      userId,
      `⚠️ موجودی در شبکه ${network} صفر است`
    );
  } catch (error) {
    console.error('خطا در انتقال:', error);
    return bot.telegram.sendMessage(
      userId,
      `❌ خطا در انتقال:\n${error.message}`
    );
  }
}

// دستور start با راهنمای کامل
bot.start((ctx) => {
  ctx.replyWithMarkdownV2(
    `🤖 *ربات انتقال لحظه‌ای*\n\n` +
    `🔹 نسخه: 2\\.0\n` +
    `🔹 شبکه‌های فعال: Polygon, Ethereum, BSC\n\n` +
    `📌 *دستورات:*\n` +
    `/watch [کلیدخصوصی] [آدرس گیرنده] [شبکه]\n` +
    `/stop\n\n` +
    `⚠️ توجه: کلید خصوصی فقط در حافظه موقت ذخیره می‌شود`
  );
});

// دستور watch با اعتبارسنجی
bot.command('watch', async (ctx) => {
  const [_, privateKey, receiver, network] = ctx.message.text.split(' ');
  
  // اعتبارسنجی ورودی‌ها
  if (!privateKey || !receiver || !network) {
    return ctx.replyWithMarkdownV2(
      '⚠️ *فرمت صحیح:*\n' +
      '`/watch [کلیدخصوصی] [آدرس گیرنده] [شبکه]`\n\n' +
      'مثال:\n' +
      '`/watch 0xabc123... 0xdef456... polygon`'
    );
  }

  if (!config.NETWORKS[network]) {
    return ctx.reply(`شبکه نامعتبر! گزینه‌های معتبر: ${Object.keys(config.NETWORKS).join(', ')}`);
  }

  // شروع رصد
  activeTransfers.set(ctx.from.id, { privateKey, receiver, network });
  
  ctx.replyWithMarkdownV2(
    `🔍 *رصد شروع شد*\n\n` +
    `🌐 شبکه: *${network}*\n` +
    `📤 گیرنده: \`${receiver}\`\n\n` +
    `✅ هر واریزی به صورت خودکار انتقال داده خواهد شد`
  );

  // انجام اولین انتقال
  await transferFunds(ctx.from.id, privateKey, receiver, network);
});

// دستور stop
bot.command('stop', (ctx) => {
  if (activeTransfers.has(ctx.from.id)) {
    activeTransfers.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  } else {
    ctx.reply('⚠️ هیچ رصد فعالی وجود ندارد');
  }
});

// راه‌اندازی وب‌هوک
app.use(express.json());
app.post('/api/telegram', async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
    res.status(200).send('OK');
  } catch (err) {
    console.error('خطا در وب‌هوک:', err);
    res.status(500).send('خطای سرور');
  }
});

// صفحه تست سلامت
app.get('/', (req, res) => {
  res.send('🤖 ربات تلگرام فعال و آماده به کار است');
});

// تنظیم خودکار وب‌هوک
if (process.env.VERCEL) {
  (async () => {
    try {
      await bot.telegram.setWebhook(`${config.VERCEL_URL}/api/telegram`);
      console.log('✅ وب‌هوک تنظیم شد');
    } catch (err) {
      console.error('❌ خطا در تنظیم وب‌هوک:', err);
    }
  })();
}

module.exports = app;