require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../src/logger'); // Tu logger EXACTO

// Función de descifrado equivalente a decryptData del servidor
function decryptData(encrypted, keyHex) {
  // encrypted: { iv: hex, content: hex, tag: hex }
  // keyHex: 64-char hex string (32 bytes)
  if (!encrypted || !encrypted.iv || !encrypted.content || !encrypted.tag) {
    throw new Error('Encrypted payload missing fields');
  }
  // validar key
  if (typeof keyHex !== 'string' || keyHex.length !== 64) {
    throw new Error('Key must be 64-hex chars (32 bytes)');
  }

  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

(async () => {
  try {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    const uuid = 'test-' + Math.random().toString(36).slice(2);

    logger.info('Test', 'Starting device registration test');
    logger.info('Test', 'Generated UUID:', uuid);

    // 1) Register device
    const reg = await axios.post(`${base}/devices/register`, { uuid });
    logger.info('Test', 'Device registration completed');
    logger.debug('Test', 'Register response:', reg.data);

    const sig = reg.data.signature;
    if (!sig) {
      logger.error('Test', 'No signature returned from register endpoint');
      return;
    }

    // 2) (opcional) Request master key directly
    try {
      logger.info('Test', 'Requesting MasterKey (simple) for signature:', sig);
      const keyResp = await axios.post(`${base}/keys/get`, { signature: sig });
      logger.info('Test', 'MasterKey (simple) response received');
      logger.debug('Test', 'MasterKey(simple):', keyResp.data);
    } catch (e) {
      logger.warn('Test', 'keys/get failed (maybe not needed) ->', e.message);
    }

    // 3) Request credentials (this endpoint returns encrypted masterKey for device + credentials encrypted with masterKey)
    logger.info('Test', 'Requesting credentials using signature:', sig);
    const credsResp = await axios.post(`${base}/credentials/get`, { signature: sig });
    logger.info('Test', 'Credentials response received');
    logger.debug('Test', 'Credentials raw:', credsResp.data);

    // Expected shape:
    // { masterKey: { iv, content, tag }, credentials: { NAME: { iv, content, tag }, ... } }
    const payload = credsResp.data;
    if (!payload || !payload.masterKey) {
      logger.error('Test', 'Invalid credentials payload:', payload);
      return;
    }

    // 4) Derivar deviceKey desde la signature: server usa signature.slice(0,64)
    const deviceKey = String(sig).slice(0, 64);
    logger.info('Test', 'Derived deviceKey (first 64 hex of signature)', deviceKey);

    // 5) Descifrar la masterKey usando deviceKey
    let masterKeyPlain;
    try {
      masterKeyPlain = decryptData(payload.masterKey, deviceKey);
      logger.info('Test', 'MasterKey decrypted successfully');
      logger.debug('Test', 'MasterKey (hex):', masterKeyPlain);
    } catch (err) {
      logger.error('Test', 'Failed to decrypt masterKey:', err);
      return;
    }

    // 6) Usar masterKeyPlain para descifrar cada credencial
    const credsEncrypted = payload.credentials || {};
    const credsDecrypted = {};
    for (const name of Object.keys(credsEncrypted)) {
      try {
        const enc = credsEncrypted[name];
        const plain = decryptData(enc, masterKeyPlain);
        credsDecrypted[name] = plain;
        logger.info('Test', `Credential decrypted: ${name}`);
        logger.debug('Test', `${name} ->`, plain);
      } catch (err) {
        logger.error('Test', `Failed to decrypt credential ${name}:`, err);
        credsDecrypted[name] = null;
      }
    }

    logger.info('Test', 'All credentials processed', credsDecrypted);
    logger.info('Test', '✅ Test finished successfully.');
  } catch (err) {
    logger.error('Test', '❌ Test failed:', err);
    if (err.response) {
      logger.error('Test', 'Response status:', err.response.status);
      logger.error('Test', 'Response data:', err.response.data);
    }
  }
})();