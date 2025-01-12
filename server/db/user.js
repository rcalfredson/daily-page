import { getCollection, initCollection } from './mongo.js';

const COLLECTION_NAME = 'users';

async function initUsersCollection() {
  await initCollection(COLLECTION_NAME);
}

export async function createUser(userData) {
  await initUsersCollection();
  const usersCollection = await getCollection(COLLECTION_NAME);
  const result = await usersCollection.insertOne(userData);
  return result.insertedId;
}

export async function findUserByEmail(email) {
  await initUsersCollection();
  const usersCollection = await getCollection(COLLECTION_NAME);
  return usersCollection.findOne({ email });
}

export async function findUserById(userId) {
  await initUsersCollection();
  const usersCollection = await getCollection(COLLECTION_NAME);
  return usersCollection.findOne({ _id: userId });
}

export async function updateUserProfile(userId, updates) {
  await initUsersCollection();
  const usersCollection = await getCollection(COLLECTION_NAME);
  return usersCollection.updateOne(
    { _id: userId },
    { $set: { ...updates, updatedAt: new Date() } }
  );
}
