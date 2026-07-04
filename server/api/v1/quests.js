import { Router } from 'express';
import optionalAuth from '../../middleware/optionalAuth.js';
import { noCache } from '../../middleware/auth.js';
import {
  claimQuestItem,
  releaseQuestItem
} from '../../db/questService.js';
import {
  approveQuestSubmission,
  createQuestSubmission,
  rejectQuestSubmission,
  reopenQuestSubmissionDraft,
  requestQuestSubmissionChanges,
  revokeQuestSubmission,
  startApprovedSubmissionRevision,
  submitQuestSubmission,
  withdrawQuestSubmission
} from '../../db/questSubmissionService.js';
import {
  getQuestSubmissionForUser,
  listAdministratorReviewQueue,
  listUserQuestSubmissions
} from '../../db/questSubmissionReadService.js';
import { QuestDomainError } from '../../db/questErrors.js';

const router = Router();

function authenticatedUserId(req, res) {
  if (req.user?.id) return String(req.user.id);
  res.status(401).json({
    error: 'Authentication is required.',
    code: 'AUTHENTICATION_REQUIRED'
  });
  return null;
}

function sendQuestError(res, error) {
  if (error instanceof QuestDomainError) {
    return res.status(error.status || 400).json({
      error: error.code,
      code: error.code,
      details: error.details
    });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({
      error: 'QUEST_INVALID',
      code: 'QUEST_INVALID',
      details: { message: error.message }
    });
  }
  console.error('Quest API error:', error);
  return res.status(500).json({
    error: 'QUEST_INTERNAL_ERROR',
    code: 'QUEST_INTERNAL_ERROR'
  });
}

function uiLang(res) {
  return res.locals.uiLang || res.locals.lang || 'en';
}

function questItemDTO(item) {
  return {
    id: String(item._id || item.id),
    questId: String(item.questId),
    key: item.key,
    label: item.label,
    reservedUntil: item.reservedUntil || null,
    activeSubmissionId: item.activeSubmissionId ? String(item.activeSubmissionId) : null,
    approvedSubmissionId: item.approvedSubmissionId ? String(item.approvedSubmissionId) : null
  };
}

export function buildQuestApiHandlers({
  claimItem = claimQuestItem,
  releaseItem = releaseQuestItem,
  createSubmission = createQuestSubmission,
  submitSubmission = submitQuestSubmission,
  requestChanges = requestQuestSubmissionChanges,
  reopenSubmission = reopenQuestSubmissionDraft,
  approveSubmission = approveQuestSubmission,
  rejectSubmission = rejectQuestSubmission,
  withdrawSubmission = withdrawQuestSubmission,
  startRevision = startApprovedSubmissionRevision,
  revokeSubmission = revokeQuestSubmission,
  getSubmission = getQuestSubmissionForUser,
  listMine = listUserQuestSubmissions,
  listReviewQueue = listAdministratorReviewQueue
} = {}) {
  async function serializeForActor(submissionId, userId, res, committed = null) {
    try {
      return await getSubmission({ submissionId, userId, uiLang: uiLang(res) });
    } catch (error) {
      if (!committed) throw error;
      console.error(`Quest transition ${submissionId} committed but response hydration failed:`, error);
      return {
        id: String(committed._id || committed.id || submissionId),
        status: committed.status || null,
        reviewHistory: Array.isArray(committed.reviewHistory) ? committed.reviewHistory : []
      };
    }
  }

  return {
    async claim(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const item = await claimItem({
          questId: req.params.questId,
          itemId: req.params.itemId,
          userId
        });
        return res.status(200).json({ item: questItemDTO(item) });
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async releaseClaim(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const item = await releaseItem({
          questId: req.params.questId,
          itemId: req.params.itemId,
          userId
        });
        return res.status(200).json({ item: questItemDTO(item) });
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async createSubmission(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      if (!req.body?.blockId) {
        return res.status(400).json({ error: 'QUEST_INVALID', code: 'QUEST_INVALID' });
      }
      try {
        const created = await createSubmission({
          questId: req.params.questId,
          itemId: req.body.itemId || null,
          blockId: req.body.blockId,
          ownerUserId: userId
        });
        const submission = await serializeForActor(created._id, userId, res, created);
        return res.status(201).json({ submission });
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async getSubmission(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const submission = await serializeForActor(req.params.submissionId, userId, res);
        return res.status(200).json({ submission });
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async listMine(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const result = await listMine({
          questId: req.params.questId,
          userId,
          status: req.query.status,
          page: req.query.page,
          limit: req.query.limit,
          uiLang: uiLang(res)
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async listReviewQueue(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const result = await listReviewQueue({
          administratorUserId: userId,
          questId: req.params.questId || null,
          page: req.query.page,
          limit: req.query.limit,
          uiLang: uiLang(res)
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async submit(req, res) {
      return ownerAction({ req, res, mutate: submitSubmission });
    },

    async withdraw(req, res) {
      return ownerAction({ req, res, mutate: withdrawSubmission });
    },

    async reopen(req, res) {
      return ownerAction({ req, res, mutate: reopenSubmission });
    },

    async startRevision(req, res) {
      const userId = authenticatedUserId(req, res);
      if (!userId) return;
      try {
        const result = await startRevision({
          submissionId: req.params.submissionId,
          ownerUserId: userId
        });
        const submission = await serializeForActor(
          result.replacementSubmission._id,
          userId,
          res,
          result.replacementSubmission
        );
        return res.status(200).json({ submission });
      } catch (error) {
        return sendQuestError(res, error);
      }
    },

    async requestChanges(req, res) {
      return administratorAction({
        req,
        res,
        mutate: requestChanges,
        input: { comment: req.body?.comment }
      });
    },

    async approve(req, res) {
      return administratorAction({
        req,
        res,
        mutate: approveSubmission,
        input: { comment: req.body?.comment || null },
        resultSubmission: result => result.submission
      });
    },

    async reject(req, res) {
      return administratorAction({
        req,
        res,
        mutate: rejectSubmission,
        input: { comment: req.body?.comment }
      });
    },

    async revoke(req, res) {
      return administratorAction({
        req,
        res,
        mutate: revokeSubmission,
        input: {
          comment: req.body?.comment || null,
          reasonCode: req.body?.reasonCode
        }
      });
    }
  };

  async function ownerAction({ req, res, mutate }) {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    try {
      const result = await mutate({
        submissionId: req.params.submissionId,
        ownerUserId: userId
      });
      const submissionId = result?._id || result?.replacementSubmission?._id;
      const submission = await serializeForActor(submissionId, userId, res, result);
      return res.status(200).json({ submission });
    } catch (error) {
      return sendQuestError(res, error);
    }
  }

  async function administratorAction({ req, res, mutate, input, resultSubmission = result => result }) {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    try {
      const result = await mutate({
        submissionId: req.params.submissionId,
        administratorUserId: userId,
        ...input
      });
      const changed = resultSubmission(result);
      const submission = await serializeForActor(changed._id, userId, res, changed);
      return res.status(200).json({ submission });
    } catch (error) {
      return sendQuestError(res, error);
    }
  }
}

const handlers = buildQuestApiHandlers();

const useQuestAPI = app => {
  app.use('/api/v1/quests', router);

  router.use(noCache);
  router.use(optionalAuth);
  router.get('/review-queue', handlers.listReviewQueue);
  router.get('/submissions/:submissionId', handlers.getSubmission);
  router.post('/submissions/:submissionId/submit', handlers.submit);
  router.post('/submissions/:submissionId/withdraw', handlers.withdraw);
  router.post('/submissions/:submissionId/reopen', handlers.reopen);
  router.post('/submissions/:submissionId/revision', handlers.startRevision);
  router.post('/submissions/:submissionId/request-changes', handlers.requestChanges);
  router.post('/submissions/:submissionId/approve', handlers.approve);
  router.post('/submissions/:submissionId/reject', handlers.reject);
  router.post('/submissions/:submissionId/revoke', handlers.revoke);
  router.get('/:questId/submissions/mine', handlers.listMine);
  router.get('/:questId/review-queue', handlers.listReviewQueue);
  router.post('/:questId/submissions', handlers.createSubmission);
  router.post('/:questId/items/:itemId/claim', handlers.claim);
  router.delete('/:questId/items/:itemId/claim', handlers.releaseClaim);
};

export default useQuestAPI;
