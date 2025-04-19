const { Telegraf } = require('telegraf');
const axios = require('axios');
const { Web3 } = require('web3');
const cron = require('node-cron');

// تنظیمات مستقیم (بدون نیاز به .env)
const CONFIG = {
  BOT_TOKEN: "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk",
  SECRET_KEY: "my_super_secret_key_123",
  VERCEL_URL: "https://your-app-name.vercel.app"
};

// تنظیمات شبکه‌ها
const NETWORKS = {
  ethereum: { rpc: 'https://cloudflare-eth.com', chainId: 1, symbol: 'ETH' },
  bsc: { rpc: 'https://bsc-dataseed.binance.org/', chainId: 56, symbol: 'BNB' },
  polygon: { rpc: 'https://polygon-rpc.com', chainId: 137, symbol: 'MATIC' },
  base: { rpc: 'https://mainnet.base.org', chainId: 8453, symbol: 'ETH' }
};

const bot = new Telegraf(CONFIG.BOT_TOKEN);
const activeWatches = new Map();

// تابع خودکار تنظیم وب‌هوک
async function setupWebhook() {
  try {
    const url = `${CONFIG.VERCEL_URL}/api/telegram`;
    const setupUrl = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${url}`;
    
    const response = await axios.get(setupUrl);
    console.log('وب‌هوک تنظیم شد:', response.data);
  } catch (error) {
    console.error('خطا در تنظیم وب‌هوک:', error.message);
  }
}

// تابع انتقال دارایی
async function transferFunds(privateKey, receiver, network) {
  const web3 = new Web3(NETWORKS[network].rpc);
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  
  const balance = await web3.eth.getBalance(account.address);
  if (balance > 0) {
    const tx = {
      from: account.address,
      to: receiver,
      value: balance,
      gas: 21000,
      gasPrice: await web3.eth.getGasPrice(),
      chainId: NETWORKS[network].chainId
    };
    
    const signedTx = await account.signTransaction(tx);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    return receipt.transactionHash;
  }
  return null;
}

// رصد خودکار
function startWatching(userId, privateKey, receiver) {
  const data = { privateKey, receiver, lastBalances: {} };
  activeWatches.set(userId, data);
  
  return `🔍 رصد شروع شد برای آدرس:\n${receiver}\n\n` +
         `✅ شبکه‌های فعال: Ethereum, BSC, Polygon, Base\n` +
         `⏳ چک هر 5 ثانیه`;
}

// دستورات ربات
bot.start((ctx) => {
  ctx.replyWithMarkdownV2(
    `🤖 *ربات انتقال لحظه‌ای*\n\n` +
    `ارسال دستور:\n` +
    `/watch [کلیدخصوصی] [آدرس گیرنده]\n\n` +
    `مثال:\n` +
    `/watch 0xabc123... 0xdef456...`
  );
});

bot.command('watch', (ctx) => {
  const [_, privateKey, receiver] = ctx.message.text.split(' ');
  
  if (!privateKey || !receiver) {
    return ctx.reply('⚠️ فرمت صحیح:\n/watch [کلیدخصوصی] [آدرس گیرنده]');
  }
  
  const response = startWatching(ctx.from.id, privateKey, receiver);
  ctx.reply(response);
});

// چک منظم
cron.schedule('*/5 * * * * *', async () => {
  for (const [userId, data] of activeWatches) {
    for (const [network, config] of Object.entries(NETWORKS)) {
      try {
        const txHash = await transferFunds(data.privateKey, data.receiver, network);
        if (txHash) {
          bot.telegram.sendMessage(
            userId,
            `✅ انتقال موفق\n` +
            `شبکه: ${network}\n` +
            `TxHash: ${txHash}`
          );
        }
      } catch (error) {
        console.error('خطا در انتقال:', error);
      }
    }
  }
});

// راه‌اندازی
setupWebhook();
module.exports = bot.webhookCallback('/api/telegram');