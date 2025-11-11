const logger = require('./logger');
const { registerDevice, getMasterKeyForDevice } = require('./deviceManager');

async function router(req, res) {
  logger.info('HTTP request', { method: req.method, url: req.url });
  try {
    if (req.method === 'POST' && req.url === '/devices/register') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { uuid } = JSON.parse(body);
          if (!uuid) {
            logger.warn('Missing uuid in register request');
            return res.writeHead(400).end('Missing uuid');
          }
          const signature = await registerDevice(uuid);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ signature }));
        } catch (err) {
          logger.error('Error handling /devices/register:', err);
          res.writeHead(500).end('Internal error');
        }
      });
    } else if (req.method === 'POST' && req.url === '/keys/get') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { signature } = JSON.parse(body);
          if (!signature) {
            logger.warn('Missing signature in keys/get request');
            return res.writeHead(400).end('Missing signature');
          }
          const encrypted = await getMasterKeyForDevice(signature);
          if (!encrypted) {
            logger.warn('Device not found for signature', signature);
            return res.writeHead(404).end('Device not found');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ masterKey: encrypted }));
        } catch (err) {
          logger.error('Error handling /keys/get:', err);
          res.writeHead(500).end('Internal error');
        }
      });
    } else if (req.method === 'POST' && req.url === '/credentials/get') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
         req.on('end', async () => {
            try {
                const { signature } = JSON.parse(body);
                if (!signature) return res.writeHead(400).end('Missing signature');
                const { getEncryptedEnvCredentialsForDevice } = require('./keyManager');
                const payload = await getEncryptedEnvCredentialsForDevice(signature);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
            } catch (err) {
                logger.error('Error handling /credentials/get:', err);
                res.writeHead(500).end('Internal error');
            }
         });
    } else {
      res.writeHead(404).end('Not found');
    }
  } catch (err) {
    logger.error('Router unexpected error:', err);
    res.writeHead(500).end('Internal server error');
  }
}

module.exports = router;
