// Script para crear el atributo `createdAt` (string) en la colección SecureData
// Uso: node scripts/create_securedata_attribute.js

const { Client, Databases } = require('node-appwrite');
require('dotenv').config();
const logger = require('../src/logger');

async function main() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const project = process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY;
  const dbId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.SECURE_KEY_COLLECTION_ID;

  if (!endpoint || !project || !key || !dbId || !collectionId) {
    console.error('Missing required env vars. Please set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID and SECURE_KEY_COLLECTION_ID');
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(key);

  const databases = new Databases(client);

  try {
    console.log('Creating string attribute `createdAt` on collection', collectionId);
    // size 255, required=false, array=false
    const res = await databases.createStringAttribute(dbId, collectionId, 'createdAt', 255, false);
    console.log('Attribute created:', res);
  } catch (err) {
    // If attribute already exists Appwrite may return an error; show it and continue
    if (err && err.response && typeof err.response === 'string' && err.response.includes('attribute_already_exists')) {
      console.log('Attribute `createdAt` already exists.');
      process.exit(0);
    }
    console.error('Error creating attribute:', err.message || err);
    process.exit(2);
  }
}

main();
