import { OWNER_FOREST_WRITING_LINK_MAX_DISTANCE } from '../../public/js/owner-forest-scene.js';
import Block from '../db/models/Block.js';
import ForestWritingTree from '../db/models/ForestWritingTree.js';
import { canonicalForestWritingLink } from './forestAuthoredObjectFormat.js';
import { buildForestOwnerGroupEvidenceReader } from './forestOwnerGroupEvidence.js';
import { validateForestOwnerInspectionTree } from './forestOwnerTreeInspection.js';
import { deriveForestOwnerPlacementIndex } from './forestOwnerPlacementNeighborhood.js';

export const FOREST_AUTHORED_WRITING_LINK_MAX_DISTANCE = OWNER_FOREST_WRITING_LINK_MAX_DISTANCE;

export class ForestAuthoredWritingLinkError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ForestAuthoredWritingLinkError';
    this.code = code;
  }
}

export async function inspectForestAuthoredWritingLink({
  ownerUserId, world, writingLink, worldX, worldY, session,
  ForestWritingTreeModel = ForestWritingTree,
  readGroupEvidence = buildForestOwnerGroupEvidenceReader({ BlockModel: Block })
}) {
  if (!session) throw new ForestAuthoredWritingLinkError('AUTHORED_WRITING_TRANSACTION_REQUIRED');
  const link = canonicalForestWritingLink(writingLink);
  const tree = await ForestWritingTreeModel.findOne({
    ownerUserId, forestId: world.forestId, writingTreeId: link.writingTreeId,
    sourceState: 'active', hiddenFromForest: false
  }).session(session).lean();
  try {
    validateForestOwnerInspectionTree(tree, world, ownerUserId, link.writingTreeId);
    const position = tree.placement;
    const index = deriveForestOwnerPlacementIndex(position);
    if (position.policyVersion !== 1 || Math.abs(position.worldX) > 1e9 || Math.abs(position.worldY) > 1e9
      || tree.placementIndex?.version !== index.version || tree.placementIndex.cellX !== index.cellX
      || tree.placementIndex.cellY !== index.cellY) throw new Error('unsupported placement');
  } catch {
    throw new ForestAuthoredWritingLinkError('AUTHORED_WRITING_UNAVAILABLE');
  }
  const evidence = await readGroupEvidence({ ownerUserId, translationGroupId: tree.translationGroupId, session });
  if (evidence.classification !== 'eligible') {
    throw new ForestAuthoredWritingLinkError('AUTHORED_WRITING_UNAVAILABLE');
  }
  if (Math.hypot(worldX - tree.placement.worldX, worldY - tree.placement.worldY)
    > FOREST_AUTHORED_WRITING_LINK_MAX_DISTANCE) {
    throw new ForestAuthoredWritingLinkError('AUTHORED_WRITING_DISTANCE');
  }
  return link;
}
