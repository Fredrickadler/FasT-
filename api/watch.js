const { Web3 } = require('web3');
const cron = require('node-cron');
const { bot } = require('../utils/telegram');
const { NETWORKS } = require('../utils/networks');
const { secureKey } = require('../utils/security');

// دیتابیس موقت کاربران
const activeWatches = new Map();

async function checkAndTransfer(userId, data) {
  try {
    const { privateKey, receiver, network } = data;
    const web3 = new Web3(NETWORKS[network].rpc);
    const account = web3.eth.accounts.privateKeyToAccount(secureKey(privateKey));
    
    const currentBalance = await web3.eth.getBalance(account.address);
    const lastBalance = data.lastBalance || '0';

    if (currentBalance > lastBalance) {
      const amount = currentBalance - lastBalance;
      const tx = {
        from: account.address,
        to: receiver,
        value: amount,
        gas: 21000,
        gasPrice: await web3.eth.getGasPrice(),
        chainId: NETWORKS[network].chainId
      };

      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      bot.telegram.sendMessage(
        userId,
        `💰 انتقال ${web3.utils.fromWei(amount, 'ether')} ${network === 'bsc' ? 'BNB' : 'ETH'}!\n` +
        `🔄 TxHash: ${receipt.transactionHash}\n` +
        `🌐 شبکه: ${network}`
      );
    }

    activeWatches.set(userId, { ...data, lastBalance: currentBalance });

  } catch (error) {
    console.error('خطا در رصد:', error);
    bot.telegram.sendMessage(userId, `⚠️ خطا در سیستم رصد: ${error.message}`);
  }
}

// هر 0.5 ثانیه چک می‌کند
cron.schedule('*/0.5 * * * * *', () => {
  activeWatches.forEach((data, userId) => {
    checkAndTransfer(userId, data);
  });
});

// مدیریت بات تلگرام
bot.command('watch', (ctx) => {
  const [_, privateKey, receiver, network] = ctx.message.text.split(' ');

  if (!privateKey || !receiver || !NETWORKS[network]) {
    return ctx.reply('⚠️ فرمت صحیح:\n/watch <privateKey> <receiverAddress> <ethereum|bsc|polygon|base>');
  }

  activeWatches.set(ctx.from.id, { privateKey, receiver, network });
  ctx.reply(`🔍 رصد ولت شروع شد! (شبکه: ${network})`);
});

bot.command('stop', (ctx) => {
  if (activeWatches.has(ctx.from.id)) {
    activeWatches.delete(ctx.from.id);
    ctx.reply('🛑 رصد متوقف شد');
  } else {
    ctx.reply('⚠️ هیچ رصد فعالی وجود ندارد');
  }
});

module.exports = bot.webhookCallback('/api/watch');