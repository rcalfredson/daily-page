import {
  getActiveQuestSubmissionsForBlock
} from './questSubmissionService.js';
import {
  assertQuestBlockMutationAllowed,
  getQuestBlockMutationPolicy
} from './questSubmissionPolicy.js';

export function buildQuestBlockMutationService({
  loadActiveSubmissions = getActiveQuestSubmissionsForBlock
} = {}) {
  async function getQuestMutationPolicyForBlock({ blockId, operation }) {
    const submissions = await loadActiveSubmissions(blockId);
    return getQuestBlockMutationPolicy({ submissions, operation });
  }

  async function assertQuestMutationAllowedForBlock({ blockId, operation }) {
    const submissions = await loadActiveSubmissions(blockId);
    return assertQuestBlockMutationAllowed({ submissions, operation });
  }

  return {
    getQuestMutationPolicyForBlock,
    assertQuestMutationAllowedForBlock
  };
}

const questBlockMutationService = buildQuestBlockMutationService();

export const getQuestMutationPolicyForBlock =
  questBlockMutationService.getQuestMutationPolicyForBlock;
export const assertQuestMutationAllowedForBlock =
  questBlockMutationService.assertQuestMutationAllowedForBlock;
