const { Web3 } = require('web3');
const cron = require('node-cron');
const { bot } = require('../utils/telegram');
const { NETWORKS } = require('../utils/networks');
const { secureKey } = require('../utils/security');

// دیتابیس موقت کاربران
const activeWatches = new Map();

// لیست همه شبکه‌ها به صورت خودکار
const ALL_NETWORKS = Object.keys(NETWORKS);

async function checkAndTransfer(userId, data) {
  try {
    const { privateKey, receiver } = data;
    
    // بررسی تمام شبکه‌ها به صورت موازی
    await Promise.all(ALL_NETWORKS.map(async (network) => {
      const web3 = new Web3(NETWORKS[network].rpc);
      const account = web3.eth.accounts.privateKeyToAccount(secureKey(privateKey));
      
      const currentBalance = await web3.eth.getBalance(account.address);
      const lastBalance = data.lastBalances?.[network] || '0';

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
        
        const amountReadable = web3.utils.fromWei(amount, 'ether');
        const symbol = NETWORKS[network].symbol;
        
        await bot.telegram.sendMessage(
          userId,
          `💰 انتقال ${amountReadable} ${symbol}!\n` +
          `🔄 TxHash: ${receipt.transactionHash}\n` +
          `🌐 شبکه: ${network.toUpperCase()}\n` +
          `✅ وضعیت: موفق`
        );
      }

      // آپدیت آخرین موجودی
      if (!data.lastBalances) data.lastBalances = {};
      data.lastBalances[network] = currentBalance;
    });

    activeWatches.set(userId, data);

  } catch (error) {
    console.error('خطا در رصد:', error);
    await bot.telegram.sendMessage(userId, `⚠️ خطا در سیستم رصد: ${error.message}`);
  }
}

// هر 0.5 ثانیه چک می‌کند
cron.schedule('*/0.5 * * * * *', () => {
  activeWatches.forEach((data, userId) => {
    checkAndTransfer(userId, data);
  });
});

// مدیریت بات تلگرام
bot.start(async (ctx) => {
  await ctx.replyWithMarkdownV2(
    `🤖 *به ربات انتقال لحظه‌ای خوش آمدید*\n\n` +
    `🔹 این ربات به صورت 24/7 تمام شبکه‌ها را رصد می‌کند\n` +
    `🔹 به محض واریز هر موجودی، آن را انتقال می‌دهد\n\n` +
    `📌 دستورات:\n` +
    `/watch [privateKey] [receiverAddress] - شروع رصد\n` +
    `/stop - توقف رصد\n\n` +
    `⚠️ توجه: کلید خصوصی شما فقط در حافظه موقت ذخیره می‌شود`
  );
});

bot.command('watch', async (ctx) => {
  const [_, privateKey, receiver] = ctx.message.text.split(' ');

  if (!privateKey || !receiver) {
    return ctx.replyWithMarkdownV2(
      '⚠️ *فرمت صحیح:*\n' +
      '`/watch [privateKey] [receiverAddress]`\n\n' +
      'مثال:\n' +
      '`/watch 0xabc123... 0xdef456...`'
    );
  }

  activeWatches.set(ctx.from.id, { privateKey, receiver });
  
  await ctx.replyWithMarkdownV2(
    `✅ *رصد شروع شد*\n\n` +
    `🔹 تمام شبکه‌ها فعال: *Ethereum, BSC, Polygon, Base*\n` +
    `🔹 رصد هر 0.5 ثانیه\n` +
    `🔹 گیرنده: \`${receiver}\`\n\n` +
    `برای توقف از دستور /stop استفاده کنید`
  );
});

bot.command('stop', async (ctx) => {
  if (activeWatches.has(ctx.from.id)) {
    activeWatches.delete(ctx.from.id);
    await ctx.reply('🛑 رصد متوقف شد');
  } else {
    await ctx.reply('⚠️ هیچ رصد فعالی وجود ندارد');
  }
});

// پاسخ به پیام‌های معمولی
bot.on('text', async (ctx) => {
  await ctx.replyWithMarkdownV2(
    'برای شروع رصد از دستور زیر استفاده کنید:\n' +
    '`/watch [privateKey] [receiverAddress]`\n\n' +
    'مثال:\n' +
    '`/watch 0xabc123... 0xdef456...`'
  );
});

// راه‌اندازی وب‌هوک برای Vercel
module.exports = bot.webhookCallback('/api/watch');