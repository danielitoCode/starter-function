// Diagnostic script: list documents from SecureData collection and print signature values
const { databases } = require('../src/appwriteClient');
const { Query } = require('node-appwrite');

const dbId = process.env.APPWRITE_DATABASE_ID;
const collectionId = process.env.SECURE_KEY_COLLECTION_ID;

(async () => {
  try {
    console.log('DB:', dbId, 'COL:', collectionId);
    const docs = await databases.listDocuments(dbId, collectionId, [Query.limit(100)]);
    console.log('Total documents returned:', docs.documents.length);
    docs.documents.forEach((d, i) => {
      const sig = typeof d.signature !== 'undefined' ? String(d.signature) : '<no signature field>';
      console.log(`${i + 1}. id=${d.$id} signature=${sig} len=${sig.length}`);
    });
  } catch (err) {
    console.error('Error listing docs:', err);
    process.exit(1);
  }
})();
