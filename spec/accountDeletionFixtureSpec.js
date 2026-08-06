import {
  ACCOUNT_DELETION_FIXTURE_SCENARIOS,
  buildAccountDeletionFixture,
  buildForestReadPaginationPosts,
  expectedRetainedPostKeys,
  fixtureObjectId,
  fixtureUuid,
  parseAccountDeletionFixtureArgs
} from '../scripts/lib/accountDeletionFixture.js';
import AuthSession from '../server/db/models/AuthSession.js';
import Backup from '../server/db/models/Backup.js';
import Block from '../server/db/models/Block.js';
import BlockComment from '../server/db/models/BlockComment.js';
import BlockReaction from '../server/db/models/BlockReaction.js';
import CommentRateEvent from '../server/db/models/CommentRateEvent.js';
import CommentReport from '../server/db/models/CommentReport.js';
import Flag from '../server/db/models/Flag.js';
import ForestOwnerWorld from '../server/db/models/ForestOwnerWorld.js';
import ForestWritingTree from '../server/db/models/ForestWritingTree.js';
import Notification from '../server/db/models/Notification.js';
import Quest from '../server/db/models/Quest.js';
import Session from '../server/db/models/Session.js';
import User from '../server/db/models/User.js';
import {
  deriveForestOwnerPlacementIndex,
} from '../server/services/forestOwnerPlacementNeighborhood.js';

describe('account deletion integration fixture definitions', () => {
  it('builds deterministic, isolated ids for every scenario', () => {
    for (const scenario of ACCOUNT_DELETION_FIXTURE_SCENARIOS) {
      const first = buildAccountDeletionFixture({
        scenario,
        passwordHash: 'hash',
        now: new Date('2026-07-27T12:00:00.000Z')
      });
      const second = buildAccountDeletionFixture({
        scenario,
        passwordHash: 'hash',
        now: new Date('2026-07-27T12:00:00.000Z')
      });

      expect(first.ids).toEqual(second.ids);
      expect(first.users.owner._id).toBe(fixtureObjectId(scenario, 'user:owner'));
      expect(first.ids.postIds).toHaveSize(8);
      expect(first.ids.commentIds).toHaveSize(5);
      expect(first.ids.notificationIds).toHaveSize(4);
      expect(first.ids.writingTreeIds).toHaveSize(3);
      expect(first.ids.forestId).toBe(fixtureUuid(scenario, 'forest:owner-world'));
      expect(first.forestWritingTrees.every((tree) => {
        const expected = deriveForestOwnerPlacementIndex({
          worldX: tree.placement.worldX,
          worldY: tree.placement.worldY,
        });
        return tree.placementIndex.version === expected.version
          && tree.placementIndex.cellX === expected.cellX
          && tree.placementIndex.cellY === expected.cellY;
      })).toBeTrue();
    }

    expect(fixtureObjectId('delete', 'user:owner'))
      .not.toBe(fixtureObjectId('anonymous', 'user:owner'));
  });

  it('models all visibility states and legacy username ownership', () => {
    const fixture = buildAccountDeletionFixture({
      scenario: 'deleted-author',
      passwordHash: 'hash'
    });

    expect(fixture.posts.ownerPublicDraft).toEqual(jasmine.objectContaining({
      visibility: 'public',
      status: 'in-progress',
      userId: fixture.users.owner._id
    }));
    expect(fixture.posts.ownerUnlistedLocked).toEqual(jasmine.objectContaining({
      visibility: 'unlisted',
      status: 'locked'
    }));
    expect(fixture.posts.ownerUnlistedDraft).toEqual(jasmine.objectContaining({
      visibility: 'unlisted',
      status: 'in-progress'
    }));
    expect(fixture.posts.ownerLegacyLocked.userId).toBeUndefined();
    expect(fixture.posts.ownerLegacyLocked.creator).toBe(fixture.users.owner.username);
  });

  it('produces records accepted by their Mongoose schemas', async () => {
    const fixture = buildAccountDeletionFixture({
      scenario: 'delete',
      passwordHash: 'hash'
    });
    const documents = [
      ...Object.values(fixture.users).map((value) => new User(value)),
      ...Object.values(fixture.posts).map((value) => new Block(value)),
      ...Object.values(fixture.comments).map((value) => new BlockComment(value)),
      ...fixture.reactions.map((value) => new BlockReaction(value)),
      ...Object.values(fixture.notifications).map((value) => new Notification(value)),
      ...fixture.flags.map((value) => new Flag(value)),
      ...fixture.commentReports.map((value) => new CommentReport(value)),
      ...fixture.rateEvents.map((value) => new CommentRateEvent(value)),
      ...fixture.authSessions.map((value) => new AuthSession(value)),
      ...fixture.sessions.map((value) => new Session(value)),
      ...fixture.backups.map((value) => new Backup(value)),
      new Quest(fixture.quest),
      new ForestOwnerWorld(fixture.forestOwnerWorld),
      ...fixture.forestWritingTrees.map((value) => new ForestWritingTree(value))
    ];

    for (const document of documents) {
      await expectAsync(document.validate()).toBeResolved();
    }
  });

  it('defines the exact retained set for each disposition', () => {
    expect(expectedRetainedPostKeys('delete')).toEqual([]);
    for (const disposition of ['deleted-author', 'anonymous']) {
      expect(expectedRetainedPostKeys(disposition)).toEqual([
        'ownerPublicDraft',
        'ownerPublicLocked',
        'ownerUnlistedLocked',
        'ownerLegacyLocked'
      ]);
    }
  });

  it('requires explicit write authorization for mutating commands', () => {
    expect(() => parseAccountDeletionFixtureArgs(['seed', 'delete']))
      .toThrowError('seed changes data and requires --write.');
    expect(() => parseAccountDeletionFixtureArgs(['reset', 'delete']))
      .toThrowError('reset changes data and requires --write.');
    expect(() => parseAccountDeletionFixtureArgs(['delete-direct', 'delete']))
      .toThrowError('delete-direct changes data and requires --write.');
    expect(() => parseAccountDeletionFixtureArgs(['create-tree-direct', 'delete']))
      .toThrowError('create-tree-direct changes data and requires --write.');
    expect(() => parseAccountDeletionFixtureArgs(['seed-forest-pagination', 'delete']))
      .toThrowError('seed-forest-pagination changes data and requires --write.');
    expect(parseAccountDeletionFixtureArgs([
      'seed',
      'anonymous',
      '--write',
      '--active-quest'
    ])).toEqual({
      command: 'seed',
      scenario: 'anonymous',
      write: true,
      activeQuest: true
    });
  });

  it('builds deterministic eligible writing for multi-page forest reads', async () => {
    const fixture = buildAccountDeletionFixture({
      scenario: 'deleted-author',
      passwordHash: 'hash'
    });
    const first = buildForestReadPaginationPosts({
      scenario: fixture.scenario,
      owner: fixture.users.owner
    });
    const second = buildForestReadPaginationPosts({
      scenario: fixture.scenario,
      owner: fixture.users.owner
    });

    expect(first).toEqual(second);
    expect(first).toHaveSize(55);
    expect(new Set(first.map(post => post._id)).size).toBe(55);
    expect(new Set(first.map(post => post.groupId)).size).toBe(55);
    expect(first.some(post => post.lang === 'es')).toBeTrue();
    expect(first.some(post => post.visibility === 'unlisted')).toBeTrue();
    expect(first.some(post => post.status === 'in-progress')).toBeTrue();
    for (const post of first) {
      await expectAsync(new Block(post).validate()).toBeResolved();
    }
  });

  it('rejects production and unknown CLI options', () => {
    expect(() => parseAccountDeletionFixtureArgs(['seed', 'delete', '--write', '--prod']))
      .toThrowError('Production database access is not supported by this fixture.');
    expect(() => parseAccountDeletionFixtureArgs(['verify-after', 'mystery']))
      .toThrowError('Scenario must be one of: delete, deleted-author, anonymous.');
  });
});
