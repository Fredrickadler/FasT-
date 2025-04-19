const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const express = require('express');
const app = express();

// تنظیمات شبکه‌ها
const NETWORKS = {
  ethereum: {
    rpc: 'https://eth.llamarpc.com',
    chainId: 1,
    symbol: 'ETH',
    scanner: 'https://etherscan.io/tx/',
    gasBuffer: 1.3 // 30% بیشتر برای اتریوم
  },
  bsc: {
    rpc: 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    symbol: 'BNB',
    scanner: 'https://bscscan.com/tx/',
    gasBuffer: 1.2
  },
  polygon: {
    rpc: 'https://polygon.llamarpc.com',
    chainId: 137,
    symbol: 'MATIC',
    scanner: 'https://polygonscan.com/tx/',
    gasBuffer: 1.15
  },
  base: {
    rpc: 'https://mainnet.base.org',
    chainId: 8453,
    symbol: 'ETH',
    scanner: 'https://basescan.org/tx/',
    gasBuffer: 1.25
  }
};

const bot = new Telegraf("7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk");
const activeTransfers = new Map();

// محاسبه هوشمند Gas Fee
async function getOptimizedGas(network) {
  const web3 = new Web3(NETWORKS[network].rpc);
  const gasPrice = await web3.eth.getGasPrice();
  return Math.floor(gasPrice * NETWORKS[network].gasBuffer);
}

// انتقال لحظه‌ای
async function instantTransfer(userId, privateKey, receiver, network) {
  try {
    const web3 = new Web3(NETWORKS[network].rpc);
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const balance = await web3.eth.getBalance(account.address);
    
    if (balance > 0) {
      const amount = web3.utils.fromWei(balance, 'ether');
      const gasPrice = await getOptimizedGas(network);
      
      // گزارش شروع
      await bot.telegram.sendMessage(
        userId,
        `⚡ شناسایی ${amount} ${NETWORKS[network].symbol} در ${network}`
      );

      const tx = {
        from: account.address,
        to: receiver,
        value: balance,
        gas: 21000,
        gasPrice: gasPrice,
        chainId: NETWORKS[network].chainId
      };

      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      // گزارش موفقیت
      await bot.telegram.sendMessage(
        userId,
        `✅ انتقال موفق!\n\n` +
        `🌐 شبکه: ${network}\n` +
        `💰 مقدار: ${amount} ${NETWORKS[network].symbol}\n` +
        `⛽ Gas: ${web3.utils.fromWei(gasPrice.toString(), 'gwei')} Gwei\n` +
        `🔗 پیوند: ${NETWORKS[network].scanner}${receipt.transactionHash}`,
        { disable_web_page_preview: true }
      );
    }
  } catch (error) {
    await bot.telegram.sendMessage(
      userId,
      `❌ خطا در ${network}:\n${error.message}`
    );
  }
}

// شروع رصد همه شبکه‌ها
function startMonitoring(userId, privateKey, receiver) {
  if (activeTransfers.has(userId)) {
    return bot.telegram.sendMessage(userId, '⚠️ رصد از قبل فعال است');
  }

  // تنظیم اینتروال 0.5 ثانیه
  const interval = setInterval(() => {
    Object.keys(NETWORKS).forEach(network => {
      instantTransfer(userId, privateKey, receiver, network);
    });
  }, 500);

  activeTransfers.set(userId, { interval });
  
  bot.telegram.sendMessage(
    userId,
    `🔔 رصد لحظه‌ای فعال شد!\n\n` +
    `⏱️ چک هر 0.5 ثانیه\n` +
    `🌐 شبکه‌ها: Ethereum, BSC, Polygon, Base\n` +
    `📤 گیرنده: ${receiver}`
  );
}

// دستورات ربات
bot.start((ctx) => {
  ctx.replyWithHTML(
    '🤖 <b>ربات انتقال لحظه‌ای چند زنجیره‌ای</b>\n\n' +
    '⚡ سرعت انتقال: <b>0.5 ثانیه</b>\n' +
    '⛽ محاسبه هوشمند کارمزد\n\n' +
    '📌 <code>/watch PRIVATE_KEY RECEIVER_ADDRESS</code>'
  );
});

bot.command('watch', (ctx) => {
  const [_, privateKey, receiver] = ctx.message.text.split(' ');
  
  if (!privateKey || !receiver) {
    return ctx.reply('⚠️ فرمت صحیح:\n/watch [کلیدخصوصی] [آدرس گیرنده]');
  }

  startMonitoring(ctx.from.id, privateKey, receiver);
});

bot.command('stop', (ctx) => {
  if (activeTransfers.has(ctx.from.id)) {
    clearInterval(activeTransfers.get(ctx.from.id).interval);
    activeTransfers.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  }
});

// راه‌اندازی
app.use(express.json());
app.post('/api/transfer', (req, res) => {
  bot.handleUpdate(req.body, res);
});
app.get('/', (req, res) => res.send('Bot Active'));

// تنظیم وب‌هوک
if (process.env.VERCEL) {
  bot.telegram.setWebhook(`${process.env.VERCEL_URL}/api/transfer`);
}

module.exports = app;