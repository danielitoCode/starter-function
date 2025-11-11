const logger = require('./logger');
const { databases } = require('./appwriteClient');
const { Query } = require('node-appwrite');
const crypto = require('crypto');
const { encryptData, decryptData, generateSecureToken } = require('./cryptoUtils'); // <-- IMPORT CRÍTICO AQUÍ

const dbId = process.env.APPWRITE_DATABASE_ID;
const masterKeyCollectionId = process.env.MASTER_KEY_COLLECTION_ID; // <-- Usando tu var de entorno

// Función reutilizable para generar una nueva master key
function createMasterKeyValue() {
  return generateSecureToken(32);
}

async function rotateMasterKey() {
  try {
    logger.info('rotateMasterKey called');
    const key = createMasterKeyValue();
    const doc = await databases.createDocument(dbId, masterKeyCollectionId, 'unique()', {
      key
    });
    logger.info('Master key rotated and stored', { id: doc.$id });
    return key;
  } catch (err) {
    logger.error('Error in rotateMasterKey:', err);
    throw err;
  }
}

async function getCurrentMasterKey() {
  try {
    logger.info('getCurrentMasterKey called');
    // Buscar la última master key por $createdAt
    const docs = await databases.listDocuments(dbId, masterKeyCollectionId, [
      Query.limit(100)
    ]);
    let keyDoc = null;
    if (docs.documents && docs.documents.length > 0) {
      const keyDocs = docs.documents.filter(d => typeof d.key !== 'undefined');
      if (keyDocs.length > 0) {
        keyDoc = keyDocs.reduce((a, b) => {
          const ta = a?.$createdAt ? new Date(a.$createdAt).getTime() : 0;
          const tb = b?.$createdAt ? new Date(b.$createdAt).getTime() : 0;
          return ta >= tb ? a : b;
        });
      }
    }
    if (!keyDoc) {
      logger.warn('No masterKey found, generating new one');
      const key = await rotateMasterKey();
      return key;
    }
    logger.info('getCurrentMasterKey result', { found: true, id: keyDoc.$id });
    return keyDoc.key;
  } catch (err) {
    logger.error('Error in getCurrentMasterKey:', err);
    throw err;
  }
}

// Función para obtener credenciales encriptadas para el dispositivo
// Nota: Las credenciales se toman de env vars como antes, pero ahora masterKey de DB
async function getEncryptedEnvCredentialsForDevice(signature) {
  try {
    logger.info('getEncryptedEnvCredentialsForDevice called', { signaturePresent: !!signature });
    if (!signature || typeof signature !== 'string') throw new Error('Missing or invalid signature');

    const masterKey = await getCurrentMasterKey();
    if (!masterKey) throw new Error('No master key available');

    const deviceKey = signature.slice(0, 64);
    if (deviceKey.length !== 64) throw new Error('Invalid device signature length');

    const encryptedMasterForDevice = encryptData(masterKey, deviceKey);

    const envListRaw = process.env.CREDENTIAL_ENV_VARS || 'APPWRITE_API_KEY,BACKEND_SECRET'; // Tus env vars a encriptar
    const envList = envListRaw.split(',').map(s => s.trim()).filter(Boolean);

    const credentials = {};
    for (const name of envList) {
      const val = process.env[name];
      if (val == null) {
        credentials[name] = null;
        logger.warn(`Env var ${name} is null/undefined`);
      } else {
        credentials[name] = encryptData(String(val), masterKey);
        logger.debug(`Encrypted ${name}`, { iv: credentials[name].iv?.slice(0, 8) + '...' });
      }
    }

    logger.info('getEncryptedEnvCredentialsForDevice success', { numCreds: Object.keys(credentials).length, envList });
    return { masterKey: encryptedMasterForDevice, credentials };
  } catch (err) {
    logger.error('Error in getEncryptedEnvCredentialsForDevice:', err);
    throw err;
  }
}

module.exports = {
  rotateMasterKey,
  getCurrentMasterKey,
  createMasterKeyValue,
  getEncryptedEnvCredentialsForDevice
};
