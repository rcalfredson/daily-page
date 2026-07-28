import {
  AccountDeletionError,
  buildAccountDeletionService,
  isRetainablePost,
  USERNAME_QUARANTINE_MS
} from '../server/services/accountDeletion.js';
import {
  deleteProfileObjects,
  managedProfileObject
} from '../server/services/accountDeletionMedia.js';
import { canEditBlockContent, isLoggedInBlockCreator } from '../server/utils/block.js';
import { buildDeleteAccountHandler } from '../server/api/v1/auth.js';

function leanResult(value) {
  return { lean: jasmine.createSpy('lean').and.resolveTo(value) };
}

function writeModel(name) {
  return {
    create: jasmine.createSpy(`${name}.create`).and.resolveTo([]),
    updateOne: jasmine.createSpy(`${name}.updateOne`).and.resolveTo({ matchedCount: 1 }),
    updateMany: jasmine.createSpy(`${name}.updateMany`).and.resolveTo({ modifiedCount: 0 }),
    deleteMany: jasmine.createSpy(`${name}.deleteMany`).and.resolveTo({ deletedCount: 0 })
  };
}

function makeModels(posts = []) {
  const models = {};
  for (const name of [
    'AccountDeletionRequest',
    'AuthSession',
    'Backup',
    'Block',
    'BlockComment',
    'BlockReaction',
    'CommentRateEvent',
    'CommentReport',
    'Flag',
    'Notification',
    'Quest',
    'QuestItem',
    'QuestSubmission',
    'Session',
    'UsernameReservation'
  ]) {
    models[name] = writeModel(name);
  }

  models.User = {
    findById: jasmine.createSpy('User.findById').and.resolveTo({
      _id: 'user-1',
      username: 'writer',
      profilePic: '/assets/img/default-pic.png'
    }),
    deleteOne: jasmine.createSpy('User.deleteOne').and.resolveTo({ deletedCount: 1 })
  };
  models.Quest.countDocuments = jasmine.createSpy('Quest.countDocuments').and.resolveTo(0);
  models.Block.find = jasmine.createSpy('Block.find').and.returnValue(leanResult(posts));
  models.BlockComment.find = jasmine.createSpy('BlockComment.find').and.returnValue(leanResult([]));
  models.QuestSubmission.find = jasmine
    .createSpy('QuestSubmission.find')
    .and.returnValue(leanResult([]));

  return models;
}

function makeResponse() {
  return {
    status: jasmine.createSpy('status').and.callFake(function status() { return this; }),
    json: jasmine.createSpy('json').and.callFake(function json() { return this; })
  };
}

describe('account deletion lifecycle', () => {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const transactionRunner = (work) => work('session');

  it('retains only public and locked unlisted posts', () => {
    expect(isRetainablePost({ visibility: 'public', status: 'in-progress' })).toBeTrue();
    expect(isRetainablePost({ visibility: 'unlisted', status: 'locked' })).toBeTrue();
    expect(isRetainablePost({ visibility: 'unlisted', status: 'in-progress' })).toBeFalse();
  });

  it('rejects deletion while the account administers an active quest', async () => {
    const models = makeModels();
    models.Quest.countDocuments.and.resolveTo(1);
    const deleteAccount = buildAccountDeletionService({
      models,
      transactionRunner,
      clearCache: jasmine.createSpy('clearCache')
    });

    await expectAsync(deleteAccount({
      userId: 'user-1',
      disposition: 'delete',
      now
    })).toBeRejectedWith(jasmine.objectContaining({
      name: 'AccountDeletionError',
      code: 'ACTIVE_QUEST_ADMIN',
      status: 409
    }));
    expect(models.User.deleteOne).not.toHaveBeenCalled();
  });

  it('retains eligible posts without ownership and deletes in-progress unlisted posts', async () => {
    const models = makeModels([
      { _id: 'public-post', visibility: 'public', status: 'in-progress' },
      { _id: 'locked-unlisted', visibility: 'unlisted', status: 'locked' },
      { _id: 'working-unlisted', visibility: 'unlisted', status: 'in-progress' }
    ]);
    const clearCache = jasmine.createSpy('clearCache');
    const deleteAccount = buildAccountDeletionService({
      models,
      transactionRunner,
      clearCache
    });

    const result = await deleteAccount({
      userId: 'user-1',
      disposition: 'deleted-author',
      now
    });

    expect(result).toEqual(jasmine.objectContaining({
      retainedPosts: 2,
      deletedPosts: 1
    }));
    expect(models.Block.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['public-post', 'locked-unlisted'] } },
      jasmine.objectContaining({
        $set: {
          creator: 'Deleted author',
          authorshipState: 'deleted-author'
        },
        $unset: { userId: 1, editToken: 1 }
      }),
      { session: 'session' }
    );
    expect(models.Block.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: ['working-unlisted'] } },
      { session: 'session' }
    );
    expect(models.UsernameReservation.updateOne).toHaveBeenCalledWith(
      { _id: 'writer' },
      {
        $set: {
          expiresAt: new Date(now.getTime() + USERNAME_QUARANTINE_MS),
          reason: 'account-deleted'
        }
      },
      { upsert: true, session: 'session' }
    );
    expect(models.AuthSession.updateMany).toHaveBeenCalled();
    expect(models.User.deleteOne).toHaveBeenCalled();
    expect(clearCache).toHaveBeenCalled();
  });

  it('does not let retained posts authorize a later account', () => {
    const user = { id: 'new-user', username: 'writer' };
    expect(isLoggedInBlockCreator(user, {
      creator: 'writer',
      authorshipState: 'deleted-author'
    })).toBeFalse();
    expect(isLoggedInBlockCreator(user, {
      creator: 'anonymous',
      authorshipState: 'anonymous'
    })).toBeFalse();
    expect(canEditBlockContent(user, {
      creator: 'Deleted author',
      authorshipState: 'deleted-author',
      status: 'in-progress'
    })).toBeFalse();
  });

  it('keeps approved quest history for a retained post while removing its owner', async () => {
    const models = makeModels([
      { _id: 'published-post', visibility: 'public', status: 'locked' }
    ]);
    models.QuestSubmission.find.and.returnValue(leanResult([{
      _id: 'approved-submission',
      blockId: 'published-post',
      status: 'approved'
    }]));
    const deleteAccount = buildAccountDeletionService({
      models,
      transactionRunner,
      clearCache: jasmine.createSpy('clearCache')
    });

    await deleteAccount({
      userId: 'user-1',
      disposition: 'anonymous',
      now
    });

    const updates = models.QuestSubmission.updateMany.calls.allArgs();
    expect(updates.some(([, update]) => update?.$set?.status === 'revoked')).toBeFalse();
    expect(updates).toContain([
      { _id: { $in: ['approved-submission'] } },
      {
        $set: { ownerUserId: null },
        $pull: { contributorUserIds: 'user-1' }
      },
      { session: 'session' }
    ]);
  });

  it('only recognizes configured app-owned profile media', () => {
    const options = { bucket: 'daily-page-media', region: 'us-east-1' };
    expect(managedProfileObject(
      'https://daily-page-media.s3.us-east-1.amazonaws.com/profile-pics/user-1.png',
      options
    )).toEqual({
      Bucket: 'daily-page-media',
      Key: 'profile-pics/user-1.png'
    });
    expect(managedProfileObject(
      'https://other.example/profile-pics/user-1.png',
      options
    )).toBeNull();
    expect(managedProfileObject(
      'https://daily-page-media.s3.us-east-1.amazonaws.com/post-images/user-1.png',
      options
    )).toBeNull();
  });

  it('deletes every profile upload for the deleted owner prefix', async () => {
    const calls = [];
    const s3 = {
      send: jasmine.createSpy('send').and.callFake(async (command) => {
        calls.push(command.input);
        if (calls.length === 1) {
          return {
            Contents: [{ Key: 'profile-pics/user-1-old.png' }],
            IsTruncated: true,
            NextContinuationToken: 'next'
          };
        }
        if (calls.length === 2) return {};
        if (calls.length === 3) {
          return {
            Contents: [{ Key: 'profile-pics/user-1-new.png' }],
            IsTruncated: false
          };
        }
        return {};
      })
    };

    await deleteProfileObjects(s3, {
      Bucket: 'daily-page-media',
      ownerUserId: 'user-1'
    });

    expect(calls[0]).toEqual({
      Bucket: 'daily-page-media',
      Prefix: 'profile-pics/user-1-',
      ContinuationToken: undefined
    });
    expect(calls[1].Delete.Objects).toEqual([{ Key: 'profile-pics/user-1-old.png' }]);
    expect(calls[2].ContinuationToken).toBe('next');
    expect(calls[3].Delete.Objects).toEqual([{ Key: 'profile-pics/user-1-new.png' }]);
  });

  it('rejects unknown writing dispositions before opening a transaction', async () => {
    const transaction = jasmine.createSpy('transactionRunner');
    const deleteAccount = buildAccountDeletionService({
      transactionRunner: transaction,
      clearCache: jasmine.createSpy('clearCache')
    });

    await expectAsync(deleteAccount({
      userId: 'user-1',
      disposition: 'surprise'
    })).toBeRejectedWithError(AccountDeletionError, 'INVALID_DISPOSITION');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('takes deletion identity only from the authenticated session', async () => {
    const deleteAccountFn = jasmine.createSpy('deleteAccount').and.resolveTo({
      retainedPosts: 2,
      deletedPosts: 1
    });
    const cleanUpMediaFn = jasmine.createSpy('cleanUpMedia').and.resolveTo({});
    const clearCookieFn = jasmine.createSpy('clearCookie');
    const handler = buildDeleteAccountHandler({
      UserModel: {
        findById: jasmine.createSpy('findById').and.resolveTo({
          password: 'hash',
          twoFactorEnabled: false
        })
      },
      comparePassword: jasmine.createSpy('comparePassword').and.resolveTo(true),
      deleteAccountFn,
      cleanUpMediaFn,
      clearCookieFn,
      logger: { error: jasmine.createSpy('error') }
    });
    const res = makeResponse();

    await handler({
      user: { id: 'session-user' },
      body: {
        userId: 'forged-user',
        currentPassword: 'password',
        disposition: 'deleted-author',
        confirmation: 'DELETE'
      }
    }, res);

    expect(deleteAccountFn).toHaveBeenCalledOnceWith({
      userId: 'session-user',
      disposition: 'deleted-author'
    });
    expect(cleanUpMediaFn).toHaveBeenCalledOnceWith({
      limit: 1,
      ownerUserId: 'session-user'
    });
    expect(clearCookieFn).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('requires a valid second factor when the account has 2FA enabled', async () => {
    const deleteAccountFn = jasmine.createSpy('deleteAccount');
    const handler = buildDeleteAccountHandler({
      UserModel: {
        findById: jasmine.createSpy('findById').and.resolveTo({
          password: 'hash',
          twoFactorEnabled: true,
          twoFactorSecret: 'secret'
        })
      },
      comparePassword: jasmine.createSpy('comparePassword').and.resolveTo(true),
      verifyTotpFn: jasmine.createSpy('verifyTotp').and.returnValue(false),
      verifyRecoveryCodeFn: jasmine.createSpy('verifyRecoveryCode').and.resolveTo(false),
      deleteAccountFn,
      logger: { error: jasmine.createSpy('error') }
    });
    const res = makeResponse();

    await handler({
      user: { id: 'session-user' },
      body: {
        currentPassword: 'password',
        twoFactorCode: 'bad-code',
        disposition: 'delete',
        confirmation: 'DELETE'
      }
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      code: 'INVALID_TWO_FACTOR_CODE'
    });
    expect(deleteAccountFn).not.toHaveBeenCalled();
  });
});
