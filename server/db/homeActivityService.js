import mongoose from 'mongoose';
import Block from './models/Block.js';
import BlockComment from './models/BlockComment.js';
import BlockReaction from './models/BlockReaction.js';
import Room from './models/Room.js';
import User from './models/User.js';
import { toRoomI18nDTO } from './roomService.js';
import { canonicalCommentPath } from '../utils/canonical.js';

const REACTION_EMOJI_BY_TYPE = {
  heart: '❤️',
  leaf: '🌿',
  wow: '😮',
  laugh: '😂'
};

function clampLimit(limit, fallback = 5, max = 8) {
  return Math.max(1, Math.min(Number(limit) || fallback, max));
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '')).filter(Boolean))];
}

function trimSnippet(value, maxLength = 180) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

async function getPublicBlocksById(blockIds = []) {
  const ids = uniqueStrings(blockIds);
  if (!ids.length) {
    return new Map();
  }

  const blocks = await Block.find({
    _id: { $in: ids },
    visibility: 'public'
  })
    .select({
      _id: 1,
      title: 1,
      roomId: 1,
      lang: 1,
      status: 1
    })
    .lean();

  return new Map(blocks.map((block) => [String(block._id), block]));
}

async function getUserContextById(userIds = []) {
  const ids = uniqueStrings(userIds).filter((userId) => mongoose.isValidObjectId(userId));
  if (!ids.length) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: ids } })
    .select({ username: 1 })
    .lean();

  return new Map(users.map((user) => [String(user._id), user]));
}

async function getLocalizedRoomsById(roomIds = [], lang = 'en') {
  const ids = uniqueStrings(roomIds);
  if (!ids.length) {
    return new Map();
  }

  const rooms = await Room.find({ _id: { $in: ids } }).lean();
  return new Map(
    rooms.map((room) => {
      const localizedRoom = lang ? toRoomI18nDTO(room, lang) : room;
      return [String(room._id), localizedRoom];
    })
  );
}

function serializeActor(userMap, rawUserId) {
  const userId = String(rawUserId || '');
  const user = userMap.get(userId);

  if (user && user.username) {
    return {
      actorUsername: user.username,
      actorProfilePath: `/users/${encodeURIComponent(user.username)}`
    };
  }

  return {
    actorUsername: mongoose.isValidObjectId(userId) ? null : userId || null,
    actorProfilePath: null
  };
}

function serializeRoom(roomMap, roomId) {
  const room = roomMap.get(String(roomId || ''));
  const resolvedRoomId = String(roomId || '');

  return {
    roomName: (room && (room.displayName || room.name)) || resolvedRoomId,
    roomPath: resolvedRoomId ? `/rooms/${encodeURIComponent(resolvedRoomId)}` : null
  };
}

export async function getRecentCommentActivity({ limit = 5, lang = 'en' } = {}) {
  const safeLimit = clampLimit(limit);
  const rawComments = await BlockComment.find({
    status: 'visible',
    deletedAt: null
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit * 6)
    .lean();

  if (!rawComments.length) {
    return [];
  }

  const blockMap = await getPublicBlocksById(rawComments.map((comment) => comment.blockId));
  const visibleComments = rawComments.filter((comment) => blockMap.has(String(comment.blockId)));

  if (!visibleComments.length) {
    return [];
  }

  const [userMap, roomMap] = await Promise.all([
    getUserContextById(visibleComments.map((comment) => comment.userId)),
    getLocalizedRoomsById(
      visibleComments
        .map((comment) => {
          const block = blockMap.get(String(comment.blockId));
          return block ? block.roomId : null;
        })
        .filter(Boolean),
      lang
    )
  ]);

  return visibleComments.slice(0, safeLimit).map((comment) => {
    const block = blockMap.get(String(comment.blockId));
    const actor = serializeActor(userMap, comment.userId);
    const room = serializeRoom(roomMap, block ? block.roomId : null);
    const commentId = String(comment._id);
    const blockId = String((block && block._id) || comment.blockId);
    const roomId = String((block && block.roomId) || '');

    return {
      _id: commentId,
      blockId,
      blockTitle: (block && block.title) || blockId,
      blockPath: `/rooms/${encodeURIComponent(roomId)}/blocks/${encodeURIComponent(blockId)}`,
      commentPath: canonicalCommentPath({ roomId, _id: blockId }, commentId),
      excerpt: trimSnippet(comment.body, 180),
      createdAt: comment.createdAt,
      isReply: Boolean(comment.parentCommentId),
      ...actor,
      ...room
    };
  });
}

export async function getRecentReactionActivity({ limit = 5, lang = 'en' } = {}) {
  const safeLimit = clampLimit(limit);
  const rawReactions = await BlockReaction.find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit * 8)
    .lean();

  if (!rawReactions.length) {
    return [];
  }

  const blockMap = await getPublicBlocksById(rawReactions.map((reaction) => reaction.blockId));
  const visibleReactions = rawReactions.filter((reaction) => blockMap.has(String(reaction.blockId)));

  if (!visibleReactions.length) {
    return [];
  }

  const [userMap, roomMap] = await Promise.all([
    getUserContextById(visibleReactions.map((reaction) => reaction.userId)),
    getLocalizedRoomsById(
      visibleReactions
        .map((reaction) => {
          const block = blockMap.get(String(reaction.blockId));
          return block ? block.roomId : null;
        })
        .filter(Boolean),
      lang
    )
  ]);

  return visibleReactions.slice(0, safeLimit).map((reaction) => {
    const block = blockMap.get(String(reaction.blockId));
    const actor = serializeActor(userMap, reaction.userId);
    const room = serializeRoom(roomMap, block ? block.roomId : null);
    const blockId = String((block && block._id) || reaction.blockId);
    const roomId = String((block && block.roomId) || '');

    return {
      _id: String(reaction._id),
      blockId,
      blockTitle: (block && block.title) || blockId,
      blockPath: `/rooms/${encodeURIComponent(roomId)}/blocks/${encodeURIComponent(blockId)}`,
      createdAt: reaction.createdAt,
      reactionType: reaction.type,
      reactionEmoji: REACTION_EMOJI_BY_TYPE[reaction.type] || '💬',
      ...actor,
      ...room
    };
  });
}
