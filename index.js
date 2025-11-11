if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const path = require('path');
const express = require('express');
const cors = require('cors'); // <-- Agregado
const { rotateMasterKey } = require('./src/keyManager');
const { registerDevice, getMasterKeyForDevice } = require('./src/deviceManager');
const { isScheduleEvent, isHttpEvent } = require('./src/helpers');

const logger = require('./src/logger');

// Appwrite cron event
if (isScheduleEvent()) {
  logger.info('Schedule event detected — rotating master key');
  rotateMasterKey()
    .then(() => {
      logger.info('Master key rotated');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Rotation error:', err);
      process.exit(1);
    });
} else if (isHttpEvent()) {
  // Appwrite HTTP event
  module.exports = async (req, res) => {
    if (req.method === 'POST' && req.url === '/devices/register') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        const { uuid } = JSON.parse(body);
        if (!uuid) return res.writeHead(400).end('Missing uuid');
        const signature = await registerDevice(uuid);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ signature }));
      });
    } else if (req.method === 'POST' && req.url === '/keys/get') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        const { signature } = JSON.parse(body);
        if (!signature) return res.writeHead(400).end('Missing signature');
        const encrypted = await getMasterKeyForDevice(signature);
        if (!encrypted) return res.writeHead(404).end('Device not found');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ masterKey: encrypted }));
      });
    } else {
      res.writeHead(404).end('Not found');
    }
  };
} else {
  // Local dev server with Express
  const app = express();

  // ✅ Habilitar CORS para todos los orígenes (para que fetch funcione desde tu HTML)
  app.use(cors());

  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json());

  app.post('/devices/register', async (req, res) => {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'Missing uuid' });
    logger.info('[registerDevice] Iniciando registro con UUID:', uuid);
    try {
      const signature = await registerDevice(uuid);
      logger.info('[registerDevice] Registro exitoso, signature:', signature);
      res.json({ signature });
    } catch (err) {
      logger.error('[registerDevice] Error:', err);
      if (err && err.statusCode === 409) return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  app.post('/keys/get', async (req, res) => {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    logger.info('[getMasterKey] Solicitando master key para signature:', signature);
    try {
      const encrypted = await getMasterKeyForDevice(signature);
      if (!encrypted) {
        logger.warn('[getMasterKey] Dispositivo no encontrado para signature:', signature);
        return res.status(404).json({ error: 'Device not found' });
      }
      logger.info('[getMasterKey] Master key obtenida');
      res.json({ masterKey: encrypted });
    } catch (err) {
      logger.error('[getMasterKey] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/credentials/get', async (req, res) => {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    logger.info('[getCredentials] Solicitando credenciales para signature:', signature);
    try {
      const { getEncryptedEnvCredentialsForDevice } = require('./src/keyManager');
      const payload = await getEncryptedEnvCredentialsForDevice(signature);
      res.json(payload);
    } catch (err) {
      logger.error('[getCredentials] Error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Express server running on http://localhost:${PORT}`);
    logger.info('ENV VARS:', {
      APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID,
      APPWRITE_API_KEY: process.env.APPWRITE_API_KEY ? '***' : undefined,
      APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT,
      APPWRITE_DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
      SECURE_KEY_COLLECTION_ID: process.env.SECURE_KEY_COLLECTION_ID,
      DEVICE_COLLECTION_ID: process.env.DEVICE_COLLECTION_ID,
      BACKEND_SECRET: process.env.BACKEND_SECRET ? '***' : undefined,
      NODE_ENV: process.env.NODE_ENV,
    });
  });
}