const { Client, Databases, Functions } = require('node-appwrite');
const logger = require('./logger');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

function initClient() {
  try {
    if (!process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
      logger.warn('Missing one or more Appwrite env vars (APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY). Ensure they are set in production.');
    }

    const client = new Client();
    if (process.env.APPWRITE_ENDPOINT) client.setEndpoint(process.env.APPWRITE_ENDPOINT);
    if (process.env.APPWRITE_PROJECT_ID) client.setProject(process.env.APPWRITE_PROJECT_ID);
    if (process.env.APPWRITE_API_KEY) client.setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const functions = new Functions(client);

    logger.info('Appwrite client initialized');
    return { client, databases, functions };
  } catch (err) {
    logger.error('Error initializing Appwrite client:', err);
    throw err;
  }
}

const { client, databases, functions } = initClient();

module.exports = {
  client,
  databases,
  functions
};
