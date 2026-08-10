import Block from './models/Block.js';
import {
  publiclyVisibleBlockMatch,
  resolvePostFamiliesForLocale
} from './blockService.js';

function clampInt(val, def, min, max) {
  const n = Number.parseInt(val, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export async function countSearchGroups({ q, roomId = null }) {
  const matchStage = publiclyVisibleBlockMatch({ $text: { $search: q } });
  if (roomId) matchStage.roomId = roomId;

  const pipeline = [
    { $match: matchStage },
    { $group: { _id: '$groupId' } },
    { $count: 'total' }
  ];

  const out = await Block.aggregate(pipeline).exec();
  return out[0]?.total || 0;
}

export async function searchBlocks({
  q,
  roomId = null,
  preferredLang = null,
  skip = 0,
  limit = 20,
}) {
  const safeSkip = clampInt(skip, 0, 0, 10000);
  const safeLimit = clampInt(limit, 20, 1, 50);

  const matchStage = publiclyVisibleBlockMatch({ $text: { $search: q } });
  if (roomId) matchStage.roomId = roomId;

  // Strategy:
  // 1) Match + score
  // 2) Sort by score desc, then updatedAt desc (your “secondary sort basis”)
  // 3) Group by groupId (dedupe translations)
  // 4) Pick preferredLang doc if present, else top-scoring doc in that group
  // 5) Return minimal fields + snippet
  const pipeline = [
    { $match: matchStage },

    { $addFields: { score: { $meta: 'textScore' } } },
    { $sort: { score: -1, updatedAt: -1 } },

    {
      $group: {
        _id: '$groupId',
        docs: { $push: '$$ROOT' },
      }
    },

    {
      $project: {
        docs: 1,
        best: preferredLang ? {
          $let: {
            vars: {
              preferred: {
                $filter: {
                  input: '$docs',
                  as: 'd',
                  cond: { $eq: ['$$d.lang', preferredLang] }
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: '$$preferred' }, 0] },
                { $arrayElemAt: ['$$preferred', 0] },
                { $arrayElemAt: ['$docs', 0] } // top-scoring in group
              ]
            }
          }
        } : { $arrayElemAt: ['$docs', 0] } // no preferredLang requested
      }
    },

    { $replaceRoot: { newRoot: '$best' } },

    // Re-sort after grouping so output ordering is stable
    { $sort: { score: -1, updatedAt: -1 } },

    { $skip: safeSkip },
    { $limit: safeLimit },

    {
      $project: {
        _id: 1,
        groupId: 1,
        title: 1,
        description: 1,
        tags: 1,
        roomId: 1,
        lang: 1,
        voteCount: 1,
        createdAt: 1,
        updatedAt: 1,
        score: 1,

        // MVP snippet: first ~240 chars of content (good enough to ship)
        snippet: { $substrCP: ['$content', 0, 240] },
      }
    }
  ];

  const familyAnchors = await Block.aggregate(pipeline).exec();
  const scoreByGroup = new Map(
    familyAnchors.map(block => [String(block.groupId), block.score])
  );
  const resolved = await resolvePostFamiliesForLocale(
    familyAnchors,
    preferredLang || '__source_only__'
  );
  return resolved.map(block => ({
    _id: block._id,
    groupId: block.groupId,
    title: block.title,
    description: block.description,
    tags: block.tags,
    roomId: block.roomId,
    lang: block.lang,
    voteCount: block.voteCount,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    score: scoreByGroup.get(String(block.groupId)),
    snippet: String(block.content || '').slice(0, 240),
    selection: block.selection
  }));
}
