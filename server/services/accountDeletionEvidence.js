import AccountDeletionRequest from '../db/models/AccountDeletionRequest.js';

export const DELETION_EVIDENCE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const TERMINAL_PROFILE_MEDIA_CLEANUP_STATUSES = Object.freeze([
  'deleted',
  'not-managed',
  'none'
]);

export const TERMINAL_FOREST_CLEANUP_STATUSES = Object.freeze([
  'completed',
  'not-required'
]);

export function accountDeletionCleanupHasConverged(request) {
  return Boolean(
    request?.status === 'completed'
    && TERMINAL_PROFILE_MEDIA_CLEANUP_STATUSES.includes(request.profileMedia?.status)
    && TERMINAL_FOREST_CLEANUP_STATUSES.includes(request.forestCleanup?.status)
  );
}

export async function scheduleAccountDeletionEvidenceExpiry({
  ownerUserId,
  AccountDeletionRequestModel = AccountDeletionRequest,
  now = new Date()
}) {
  if (!ownerUserId) {
    throw new Error('Account-deletion evidence expiry requires ownerUserId.');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('Account-deletion evidence expiry requires a valid time.');
  }

  const evidenceExpiresAt = new Date(now.getTime() + DELETION_EVIDENCE_RETENTION_MS);
  const result = await AccountDeletionRequestModel.updateOne(
    {
      ownerUserId: String(ownerUserId),
      status: 'completed',
      evidenceExpiresAt: null,
      'profileMedia.status': { $in: TERMINAL_PROFILE_MEDIA_CLEANUP_STATUSES },
      'forestCleanup.status': { $in: TERMINAL_FOREST_CLEANUP_STATUSES }
    },
    { $set: { evidenceExpiresAt } }
  );

  return {
    scheduled: Number(result?.modifiedCount || 0) === 1,
    evidenceExpiresAt
  };
}

export async function scheduleConvergedAccountDeletionEvidenceExpiries({
  limit = 100,
  AccountDeletionRequestModel = AccountDeletionRequest,
  scheduleEvidenceExpiry = scheduleAccountDeletionEvidenceExpiry,
  logger = console,
  now = new Date()
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('limit must be an integer from 1 through 1000.');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('now must be a valid Date.');
  }

  const requests = await AccountDeletionRequestModel.find({
    status: 'completed',
    evidenceExpiresAt: null,
    'profileMedia.status': { $in: TERMINAL_PROFILE_MEDIA_CLEANUP_STATUSES },
    'forestCleanup.status': { $in: TERMINAL_FOREST_CLEANUP_STATUSES }
  }, { ownerUserId: 1 }).sort({ completedAt: 1 }).limit(limit).lean();
  const totals = { inspected: requests.length, scheduled: 0, failed: 0 };

  for (const request of requests) {
    try {
      const result = await scheduleEvidenceExpiry({
        ownerUserId: request.ownerUserId,
        AccountDeletionRequestModel,
        now
      });
      if (result.scheduled) totals.scheduled += 1;
    } catch (error) {
      totals.failed += 1;
      logger.error('Failed account-deletion evidence expiry scheduling:', {
        error: error?.name || 'Error'
      });
    }
  }

  return totals;
}
