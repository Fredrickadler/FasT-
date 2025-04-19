const crypto = require('crypto');

module.exports = {
  secureKey: (privateKey) => {
    // رمزنگاری ساده برای امنیت بیشتر
    const cipher = crypto.createCipher('aes-256-cbc', process.env.SECRET_KEY);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  },
  
  decryptKey: (encryptedKey) => {
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.SECRET_KEY);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
};