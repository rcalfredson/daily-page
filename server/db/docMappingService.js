import Backup from './models/Backup.js';

/**
 * Upsert docMappings + update lastUpdate
 */
export async function updateDocMappings(mappings) {
  // 1) upsert the docMappings doc
  await Backup.replaceOne({ _id: 'docMappings' }, mappings, { upsert: true });

  // 2) upsert the lastUpdate doc with a new timestamp
  await Backup.updateOne(
    { _id: 'lastUpdate' },
    { $set: { ts: Date.now() } },
    { upsert: true },
  );
}

/**
 * Retrieve docMappings, ensuring they're not older than 5 minutes
 */
export async function getDocMappings() {
  // 1) Check the lastUpdate doc
  let updateDoc = await Backup.findOne({ _id: 'lastUpdate' });
  if (!updateDoc) {
    throw new Error('No "lastUpdate" doc found in backup collection');
  }
  updateDoc = updateDoc.toObject();

  if (Date.now() - updateDoc.ts > 5 * 60 * 1000) {
    throw new Error('Doc mappings outdated');
  }

  // 2) Retrieve docMappings doc
  let docMappings = await Backup.findOne({ _id: 'docMappings' });
  if (!docMappings) {
    throw new Error('No "docMappings" doc found in backup collection');
  }
  docMappings = docMappings.toObject();

  delete docMappings._id;

  return docMappings;
}
