const crypto = require('crypto');
const logger = require('./logger');

function generateSecureToken(length = 64) {
  try {
    const token = crypto.randomBytes(length).toString('hex');
    logger.debug('generateSecureToken produced token', { length });
    return token;
  } catch (err) {
    logger.error('Error generating secure token:', err);
    throw err;
  }
}

function hashUUID(uuid, backendSecret) {
  try {
    const result = crypto.createHash('sha256').update(uuid + backendSecret).digest('hex');
    logger.debug('hashUUID computed', { uuid, truncated: result.slice(0, 8) });
    return result;
  } catch (err) {
    logger.error('Error hashing UUID:', err);
    throw err;
  }
}

function encryptData(data, key) {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    const payload = {
      iv: iv.toString('hex'),
      content: encrypted,
      tag: tag.toString('hex')
    };
    logger.debug('encryptData success', { iv: payload.iv });
    return payload;
  } catch (err) {
    logger.error('Error encrypting data:', err);
    throw err;
  }
}

function decryptData(encrypted, key) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      Buffer.from(encrypted.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    logger.debug('decryptData success');
    return decrypted;
  } catch (err) {
    logger.error('Error decrypting data:', err);
    throw err;
  }
}

function ensureKeyIs32BytesHex(key) {
  if (typeof key !== 'string' || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error('Key must be a 64-character hex string (32 bytes)');
  }
}

module.exports = {
  generateSecureToken,
  hashUUID,
  encryptData,
  decryptData,
  ensureKeyIs32BytesHex
};
