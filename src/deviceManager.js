const logger = require('./logger');
const { databases } = require('./appwriteClient');
const { Query } = require('node-appwrite');
const { hashUUID, encryptData } = require('./cryptoUtils');

const dbId = process.env.APPWRITE_DATABASE_ID;
const collectionId = process.env.SECURE_KEY_COLLECTION_ID; // SecureData collection
const backendSecret = process.env.BACKEND_SECRET;

async function registerDevice(uuid) {
  try {
    logger.info('registerDevice called', { uuid });

    // Buscar si ya existe un registro con ese uuid
    const existing = await databases.listDocuments(dbId, collectionId, [
      Query.equal('uuid', uuid),
      Query.limit(1)
    ]);
    if (existing.documents && existing.documents.length > 0) {
      logger.warn('registerDevice: UUID already exists', { uuid });
      const err = new Error('UUID already registered');
      err.statusCode = 409;
      throw err;
    }

    const signature = hashUUID(uuid, backendSecret);
    const doc = await databases.createDocument(dbId, collectionId, 'unique()', {
      uuid,
      signature
    });
    logger.info('Device registered', { id: doc.$id, signature });
    return signature;
  } catch (err) {
    // Mensajes más útiles para errores comunes
    if (err && err.type === 'collection_not_found') {
      logger.error('Error in registerDevice: collection_not_found. Check SECURE_KEY_COLLECTION_ID matches the collection ID in Appwrite Console.', err.response || err);
    } else if (err && err.code === 401) {
      logger.error('Error in registerDevice: authentication/authorization issue. Verify APPWRITE_PROJECT_ID and APPWRITE_API_KEY.', err.response || err);
    } else if (err && err.cause && err.cause.code && String(err.cause.code).startsWith('UND_ERR')) {
      logger.error('Network error when contacting Appwrite (connect timeout or DNS). Check network connectivity and APPWRITE_ENDPOINT:', err.cause);
    } else if (err && err.statusCode === 409) {
      logger.warn('registerDevice: UUID already exists (handled)', { uuid });
    } else {
      logger.error('Error in registerDevice:', err);
    }
    throw err;
  }
}

async function verifyDevice(signature) {
  try {
    // Normalize incoming signature: ensure string and trim whitespace/newlines
    signature = signature && typeof signature === 'string' ? signature.trim() : String(signature || '').trim();
    logger.info('verifyDevice called', { signature });
    const docs = await databases.listDocuments(dbId, collectionId, [
      Query.equal('signature', signature),
      Query.limit(1)
    ]);
    const found = docs.documents && docs.documents.length > 0 ? docs.documents[0] : null;
    logger.info('verifyDevice result', { found: !!found, signature });
    return found;
  } catch (err) {
    if (err && err.type === 'collection_not_found') {
      logger.error('Error in verifyDevice: collection_not_found. Check SECURE_KEY_COLLECTION_ID.', err.response || err);
    } else {
      logger.error('Error in verifyDevice:', err);
    }
    throw err;
  }
}

async function getMasterKeyForDevice(signature) {
  try {
    logger.info('getMasterKeyForDevice called', { signature });
    const device = await verifyDevice(signature);
    if (!device) {
      logger.warn('Device not found for signature', { signature });
      return null;
    }
    const { getCurrentMasterKey } = require('./keyManager');
    const masterKey = await getCurrentMasterKey();
    if (!masterKey) {
      logger.warn('No masterKey available');
      return null;
    }
    // Encrypt masterKey with device signature-derived key (take first 64 hex chars => 32 bytes)
    const key = signature.slice(0, 64);
    const encrypted = encryptData(masterKey, key);
    logger.info('Master key encrypted for device', { deviceId: device.$id });
    return encrypted;
  } catch (err) {
    logger.error('Error in getMasterKeyForDevice:', err);
    throw err;
  }
}

module.exports = {
  registerDevice,
  verifyDevice,
  getMasterKeyForDevice
};