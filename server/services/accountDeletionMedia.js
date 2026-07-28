import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3';
import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';

function managedProfileObject(url, {
  bucket = process.env.S3_BUCKET_NAME,
  region = process.env.AWS_REGION
} = {}) {
  if (!url || !bucket || !region) return null;

  try {
    const parsed = new URL(url);
    const expectedHost = `${bucket}.s3.${region}.amazonaws.com`;
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ''));
    if (parsed.protocol !== 'https:' || parsed.hostname !== expectedHost) return null;
    if (!key.startsWith('profile-pics/')) return null;
    return { Bucket: bucket, Key: key };
  } catch {
    return null;
  }
}

function makeS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      : undefined
  });
}

async function deleteProfileObjects(s3, { Bucket, ownerUserId }) {
  const Prefix = `profile-pics/${ownerUserId}-`;
  let ContinuationToken;

  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket,
      Prefix,
      ContinuationToken
    }));
    const Objects = (page.Contents || [])
      .map((object) => object.Key)
      .filter(Boolean)
      .map((Key) => ({ Key }));
    if (Objects.length) {
      const deleted = await s3.send(new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects, Quiet: true }
      }));
      if (deleted.Errors?.length) {
        const error = new Error('One or more profile objects could not be deleted.');
        error.name = 'ProfileMediaDeleteError';
        throw error;
      }
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

export async function cleanUpAccountDeletionMedia({
  limit = 25,
  ownerUserId = null,
  AccountDeletionRequestModel = AccountDeletionRequest,
  s3 = makeS3Client(),
  now = new Date()
} = {}) {
  const requests = await AccountDeletionRequestModel.find({
    status: 'completed',
    'profileMedia.status': 'pending',
    ...(ownerUserId ? { ownerUserId: String(ownerUserId) } : {})
  }).sort({ completedAt: 1 }).limit(limit);

  const totals = { deleted: 0, notManaged: 0, failed: 0 };
  for (const request of requests) {
    const object = managedProfileObject(request.profileMedia?.url);
    request.profileMedia.attempts = Number(request.profileMedia.attempts || 0) + 1;
    request.profileMedia.lastAttemptAt = now;

    if (!object) {
      request.profileMedia.status = 'not-managed';
      await request.save();
      totals.notManaged += 1;
      continue;
    }

    try {
      await deleteProfileObjects(s3, {
        Bucket: object.Bucket,
        ownerUserId: String(request.ownerUserId)
      });
      request.profileMedia.status = 'deleted';
      await request.save();
      totals.deleted += 1;
    } catch (error) {
      await request.save();
      totals.failed += 1;
      console.error('Failed account-deletion profile-media cleanup:', {
        attempt: request.profileMedia.attempts,
        error: error?.name || 'Error'
      });
    }
  }

  return totals;
}

export { deleteProfileObjects, managedProfileObject };
