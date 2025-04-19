const { Web3 } = require('web3');
const { bot } = require('../utils/telegram');
const { NETWORKS } = require('../utils/networks');
const { secureKey } = require('../utils/security');

module.exports = async (req, res) => {
  try {
    const { privateKey, receiver, network } = req.body;
    
    if (!privateKey || !receiver || !network) {
      return res.status(400).json({ error: 'پارامترهای ضروری ارسال نشده' });
    }

    // اعتبارسنجی شبکه
    if (!NETWORKS[network]) {
      return res.status(400).json({ error: 'شبکه نامعتبر' });
    }

    const web3 = new Web3(NETWORKS[network].rpc);
    const account = web3.eth.accounts.privateKeyToAccount(secureKey(privateKey));
    
    // انتقال Native Token
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
      
      return res.json({
        success: true,
        txHash: receipt.transactionHash,
        amount: web3.utils.fromWei(balance, 'ether'),
        currency: network === 'bsc' ? 'BNB' : 'ETH'
      });
    }

    return res.json({ success: false, message: 'موجودی صفر' });

  } catch (error) {
    console.error('خطا در انتقال:', error);
    return res.status(500).json({ error: error.message });
  }
};