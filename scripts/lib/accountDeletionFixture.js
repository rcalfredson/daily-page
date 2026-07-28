import crypto from 'node:crypto';

export const ACCOUNT_DELETION_FIXTURE_SCENARIOS = Object.freeze([
  'delete',
  'deleted-author',
  'anonymous'
]);

export const ACCOUNT_DELETION_FIXTURE_ROOM_ID = 'account-deletion-fixture';
export const ACCOUNT_DELETION_FIXTURE_TAG = 'account-deletion-fixture';
export const DEFAULT_ACCOUNT_DELETION_FIXTURE_PASSWORD = 'DeletionFixture!2026';

export function fixtureObjectId(scenario, key) {
  return crypto
    .createHash('sha256')
    .update(`${ACCOUNT_DELETION_FIXTURE_TAG}:${scenario}:${key}`)
    .digest('hex')
    .slice(0, 24);
}

export function assertFixtureScenario(scenario) {
  if (!ACCOUNT_DELETION_FIXTURE_SCENARIOS.includes(scenario)) {
    throw new Error(
      `Scenario must be one of: ${ACCOUNT_DELETION_FIXTURE_SCENARIOS.join(', ')}.`
    );
  }
  return scenario;
}

export function parseAccountDeletionFixtureArgs(argv) {
  const [command, scenarioArg, ...options] = argv;
  const args = {
    command,
    scenario: scenarioArg,
    write: false,
    activeQuest: false
  };

  if (command === '--help' || command === '-h' || !command) {
    return { ...args, help: true };
  }

  const commands = [
    'seed',
    'reset',
    'verify-before',
    'delete-direct',
    'verify-after',
    'archive-quest'
  ];
  if (!commands.includes(command)) {
    throw new Error(`Unknown command "${command}".`);
  }
  if (!scenarioArg) throw new Error('A scenario is required.');
  assertFixtureScenario(scenarioArg);

  for (const option of options) {
    if (option === '--write') args.write = true;
    else if (option === '--active-quest') args.activeQuest = true;
    else if (option === '--prod') {
      throw new Error('Production database access is not supported by this fixture.');
    } else {
      throw new Error(`Unknown option "${option}".`);
    }
  }

  if (args.activeQuest && command !== 'seed') {
    throw new Error('--active-quest is only valid with the seed command.');
  }
  if (['seed', 'reset', 'delete-direct', 'archive-quest'].includes(command) && !args.write) {
    throw new Error(`${command} changes data and requires --write.`);
  }

  return args;
}

function fixtureDate(now, minutesAgo) {
  return new Date(now.getTime() - (minutesAgo * 60 * 1000));
}

function userDefinition(scenario, role, passwordHash, now) {
  const username = `deletion-${scenario}-${role}`;
  return {
    _id: fixtureObjectId(scenario, `user:${role}`),
    username,
    email: `${username}@example.invalid`,
    password: passwordHash,
    verified: true,
    verificationToken: null,
    verificationTokenExpires: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    twoFactorEnabled: false,
    profilePic: '/assets/img/default-pic.png',
    bio: `Disposable ${role} account for the ${scenario} account-deletion fixture.`,
    preferredUiLang: 'en',
    createdAt: fixtureDate(now, 240),
    updatedAt: fixtureDate(now, 240)
  };
}

function postDefinition({
  scenario,
  key,
  title,
  owner,
  groupKey = key,
  lang = 'en',
  visibility = 'public',
  status = 'locked',
  creator = owner.username,
  userId = owner._id,
  collaborators = [],
  votes = [],
  originalAuthor,
  originalBlock,
  now,
  minutesAgo
}) {
  const post = {
    _id: fixtureObjectId(scenario, `post:${key}`),
    title: `[Deletion ${scenario}] ${title}`,
    description: `Disposable integration fixture post: ${key}.`,
    tags: [ACCOUNT_DELETION_FIXTURE_TAG, `account-deletion-${scenario}`, key],
    content: [
      `# ${title}`,
      '',
      `This disposable post exercises the **${scenario}** account-deletion path.`,
      '',
      `Fixture key: \`${key}\`.`
    ].join('\n'),
    roomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
    creator,
    userId,
    authorshipState: 'live',
    editToken: `fixture-edit-${scenario}-${key}`,
    collaborators,
    visibility,
    status,
    votes,
    voteCount: votes.reduce(
      (total, vote) => total + (vote.type === 'upvote' ? 1 : -1),
      0
    ),
    groupId: fixtureObjectId(scenario, `group:${groupKey}`),
    lang,
    createdAt: fixtureDate(now, minutesAgo),
    updatedAt: fixtureDate(now, minutesAgo)
  };
  if (status === 'locked') {
    post.lockedAt = fixtureDate(now, Math.max(0, minutesAgo - 1));
  }
  if (originalAuthor) post.originalAuthor = originalAuthor;
  if (originalBlock) post.originalBlock = originalBlock;
  if (!userId) delete post.userId;
  return post;
}

export function buildAccountDeletionFixture({
  scenario,
  passwordHash,
  activeQuest = false,
  now = new Date()
}) {
  assertFixtureScenario(scenario);
  if (!passwordHash) throw new Error('passwordHash is required.');

  const owner = userDefinition(scenario, 'owner', passwordHash, now);
  const peer = userDefinition(scenario, 'peer', passwordHash, now);
  const observer = userDefinition(scenario, 'observer', passwordHash, now);
  const users = { owner, peer, observer };

  const ownerSourceId = fixtureObjectId(scenario, 'post:owner-public-locked');
  const posts = {
    ownerPublicDraft: postDefinition({
      scenario,
      key: 'owner-public-draft',
      title: 'Owner public draft',
      owner,
      status: 'in-progress',
      collaborators: [peer.username],
      now,
      minutesAgo: 115
    }),
    ownerPublicLocked: postDefinition({
      scenario,
      key: 'owner-public-locked',
      title: 'Owner public locked source',
      owner,
      collaborators: [peer.username],
      votes: [{ userId: peer._id, type: 'upvote' }],
      now,
      minutesAgo: 110
    }),
    ownerUnlistedLocked: postDefinition({
      scenario,
      key: 'owner-unlisted-locked',
      title: 'Owner locked unlisted post',
      owner,
      visibility: 'unlisted',
      collaborators: [observer.username],
      now,
      minutesAgo: 105
    }),
    ownerUnlistedDraft: postDefinition({
      scenario,
      key: 'owner-unlisted-draft',
      title: 'Owner in-progress unlisted post',
      owner,
      visibility: 'unlisted',
      status: 'in-progress',
      now,
      minutesAgo: 100
    }),
    ownerLegacyLocked: postDefinition({
      scenario,
      key: 'owner-legacy-locked',
      title: 'Owner legacy username-only post',
      owner,
      userId: null,
      now,
      minutesAgo: 95
    }),
    peerPublicLocked: postDefinition({
      scenario,
      key: 'peer-public-locked',
      title: 'Peer post with owner interactions',
      owner: peer,
      collaborators: [owner.username, observer.username],
      votes: [
        { userId: owner._id, type: 'upvote' },
        { userId: observer._id, type: 'downvote' }
      ],
      now,
      minutesAgo: 90
    }),
    peerTranslation: postDefinition({
      scenario,
      key: 'peer-translation',
      title: 'Peer translation of owner source',
      owner: peer,
      groupKey: 'owner-public-locked',
      lang: 'es',
      originalAuthor: owner.username,
      originalBlock: ownerSourceId,
      now,
      minutesAgo: 85
    }),
    observerPublicLocked: postDefinition({
      scenario,
      key: 'observer-public-locked',
      title: 'Observer control post',
      owner: observer,
      now,
      minutesAgo: 80
    })
  };

  const comments = {
    ownerOnPeer: {
      _id: fixtureObjectId(scenario, 'comment:owner-on-peer'),
      blockId: posts.peerPublicLocked._id,
      userId: owner._id,
      body: 'Owner top-level comment; it and its reply should be deleted.',
      parentCommentId: null,
      status: 'visible',
      createdAt: fixtureDate(now, 70),
      updatedAt: fixtureDate(now, 70)
    },
    peerReplyToOwner: {
      _id: fixtureObjectId(scenario, 'comment:peer-reply-to-owner'),
      blockId: posts.peerPublicLocked._id,
      userId: peer._id,
      body: 'Peer reply whose owner-authored parent will be deleted.',
      parentCommentId: fixtureObjectId(scenario, 'comment:owner-on-peer'),
      status: 'visible',
      createdAt: fixtureDate(now, 65),
      updatedAt: fixtureDate(now, 65)
    },
    peerOnOwner: {
      _id: fixtureObjectId(scenario, 'comment:peer-on-owner'),
      blockId: posts.ownerPublicLocked._id,
      userId: peer._id,
      body: 'Peer comment on a retainable owner post.',
      parentCommentId: null,
      status: 'visible',
      createdAt: fixtureDate(now, 60),
      updatedAt: fixtureDate(now, 60)
    },
    ownerReplyToPeer: {
      _id: fixtureObjectId(scenario, 'comment:owner-reply-to-peer'),
      blockId: posts.ownerPublicLocked._id,
      userId: owner._id,
      body: 'Owner reply that should be deleted even if its parent post remains.',
      parentCommentId: fixtureObjectId(scenario, 'comment:peer-on-owner'),
      status: 'visible',
      createdAt: fixtureDate(now, 55),
      updatedAt: fixtureDate(now, 55)
    },
    observerOnPeer: {
      _id: fixtureObjectId(scenario, 'comment:observer-on-peer'),
      blockId: posts.peerPublicLocked._id,
      userId: observer._id,
      body: 'Observer control comment that should survive every disposition.',
      parentCommentId: null,
      status: 'visible',
      createdAt: fixtureDate(now, 50),
      updatedAt: fixtureDate(now, 50)
    }
  };

  const notifications = {
    addressedToOwner: {
      _id: fixtureObjectId(scenario, 'notification:addressed-to-owner'),
      userId: owner._id,
      type: 'block_comment',
      actorUserId: peer._id,
      blockId: posts.ownerPublicLocked._id,
      commentId: comments.peerOnOwner._id,
      createdAt: fixtureDate(now, 45)
    },
    ownerCommentToPeer: {
      _id: fixtureObjectId(scenario, 'notification:owner-comment-to-peer'),
      userId: peer._id,
      type: 'block_comment',
      actorUserId: owner._id,
      blockId: posts.peerPublicLocked._id,
      commentId: comments.ownerOnPeer._id,
      createdAt: fixtureDate(now, 40)
    },
    survivingDeletedActor: {
      _id: fixtureObjectId(scenario, 'notification:surviving-deleted-actor'),
      userId: observer._id,
      type: 'block_comment',
      actorUserId: owner._id,
      blockId: posts.peerPublicLocked._id,
      commentId: comments.observerOnPeer._id,
      createdAt: fixtureDate(now, 35)
    },
    ownerPostControl: {
      _id: fixtureObjectId(scenario, 'notification:owner-post-control'),
      userId: peer._id,
      type: 'block_comment',
      actorUserId: observer._id,
      blockId: posts.ownerPublicLocked._id,
      commentId: comments.peerOnOwner._id,
      createdAt: fixtureDate(now, 30)
    }
  };

  const reactions = [
    {
      _id: fixtureObjectId(scenario, 'reaction:owner-on-peer'),
      blockId: posts.peerPublicLocked._id,
      userId: owner._id,
      type: 'heart',
      createdAt: fixtureDate(now, 25),
      updatedAt: fixtureDate(now, 25)
    },
    {
      _id: fixtureObjectId(scenario, 'reaction:observer-on-peer'),
      blockId: posts.peerPublicLocked._id,
      userId: observer._id,
      type: 'leaf',
      createdAt: fixtureDate(now, 24),
      updatedAt: fixtureDate(now, 24)
    },
    {
      _id: fixtureObjectId(scenario, 'reaction:peer-on-owner'),
      blockId: posts.ownerPublicLocked._id,
      userId: peer._id,
      type: 'wow',
      createdAt: fixtureDate(now, 23),
      updatedAt: fixtureDate(now, 23)
    }
  ];

  const flags = [
    {
      _id: fixtureObjectId(scenario, 'flag:owner-on-peer'),
      blockId: posts.peerPublicLocked._id,
      reason: 'other',
      description: 'Fixture flag whose deleted reporter should be scrubbed.',
      reporter: owner.username,
      status: 'open',
      createdAt: fixtureDate(now, 22),
      updatedAt: fixtureDate(now, 22)
    },
    {
      _id: fixtureObjectId(scenario, 'flag:peer-on-owner'),
      blockId: posts.ownerPublicLocked._id,
      reason: 'other',
      description: 'Fixture flag on a post that may be retained or deleted.',
      reporter: peer.username,
      status: 'open',
      createdAt: fixtureDate(now, 21),
      updatedAt: fixtureDate(now, 21)
    }
  ];

  const commentReports = [
    {
      _id: fixtureObjectId(scenario, 'comment-report:owner'),
      commentId: comments.observerOnPeer._id,
      reporterId: owner._id,
      createdAt: fixtureDate(now, 20)
    },
    {
      _id: fixtureObjectId(scenario, 'comment-report:peer'),
      commentId: comments.ownerReplyToPeer._id,
      reporterId: peer._id,
      createdAt: fixtureDate(now, 19)
    }
  ];

  const authSessions = [
    {
      _id: fixtureObjectId(scenario, 'auth-session:owner-secondary'),
      userId: owner._id,
      tokenHash: crypto
        .createHash('sha256')
        .update(`${scenario}:owner-secondary-session`)
        .digest('hex'),
      remembered: true,
      userAgentHash: null,
      createdAt: fixtureDate(now, 15),
      lastSeenAt: fixtureDate(now, 5),
      expiresAt: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
      absoluteExpiresAt: new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)),
      revokedAt: null
    }
  ];

  const rateEvents = [
    {
      _id: fixtureObjectId(scenario, 'rate-event:owner'),
      userId: owner._id,
      ipHash: crypto.createHash('sha256').update(`${scenario}:fixture-ip`).digest('hex'),
      kind: 'comment',
      hasUrl: false,
      createdAt: fixtureDate(now, 1)
    }
  ];

  const collaborationPostIds = [
    posts.ownerPublicDraft._id,
    posts.ownerPublicLocked._id,
    posts.ownerUnlistedDraft._id,
    posts.peerPublicLocked._id
  ];
  const sessions = collaborationPostIds.map((postId, index) => ({
    _id: postId,
    roomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
    peers: {
      [`fixture-peer-${index}`]: {
        roomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
        timestamp: now.getTime()
      }
    }
  }));
  const backups = collaborationPostIds.map((postId, index) => ({
    _id: postId,
    roomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
    ts: now.getTime() - index
  }));

  const quest = {
    _id: fixtureObjectId(scenario, 'quest:guard'),
    slug: `account-deletion-${scenario}-guard`,
    type: 'count',
    status: activeQuest ? 'active' : 'archived',
    name_i18n: { en: `[Deletion ${scenario}] active administrator guard` },
    description_i18n: { en: 'Disposable quest for account-deletion integration testing.' },
    instructions_i18n: { en: 'Archive this quest before deleting its administrator.' },
    administratorUserId: owner._id,
    allowedRoomIds: [ACCOUNT_DELETION_FIXTURE_ROOM_ID],
    defaultRoomId: ACCOUNT_DELETION_FIXTURE_ROOM_ID,
    badgeAssetPath: '/assets/img/quests/virtual-road-trip.svg',
    acceptingSubmissionsAfterCompletion: false,
    targetCount: 1,
    createdAt: fixtureDate(now, 120),
    updatedAt: fixtureDate(now, 120)
  };

  return {
    scenario,
    users,
    posts,
    comments,
    notifications,
    reactions,
    flags,
    commentReports,
    authSessions,
    rateEvents,
    sessions,
    backups,
    quest,
    ids: {
      userIds: Object.values(users).map((user) => user._id),
      postIds: Object.values(posts).map((post) => post._id),
      commentIds: Object.values(comments).map((comment) => comment._id),
      notificationIds: Object.values(notifications).map((notification) => notification._id),
      reactionIds: reactions.map((reaction) => reaction._id),
      flagIds: flags.map((flag) => flag._id),
      commentReportIds: commentReports.map((report) => report._id),
      authSessionIds: authSessions.map((session) => session._id),
      rateEventIds: rateEvents.map((event) => event._id),
      questId: quest._id
    }
  };
}

export function expectedRetainedPostKeys(disposition) {
  if (disposition === 'delete') return [];
  return [
    'ownerPublicDraft',
    'ownerPublicLocked',
    'ownerUnlistedLocked',
    'ownerLegacyLocked'
  ];
}
