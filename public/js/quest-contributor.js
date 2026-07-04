document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-quest-contributor]');
  if (!root) return;

  const questId = root.dataset.questId;
  const genericError = root.dataset.errorMessage;

  async function mutate(url, method = 'POST') {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : '{}'
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        QUEST_SUBMISSION_BLOCK_INELIGIBLE: root.dataset.blockIneligibleMessage,
        QUEST_ITEM_UNAVAILABLE: root.dataset.itemUnavailableMessage,
        QUEST_CLAIM_EXPIRED: root.dataset.itemUnavailableMessage
      };
      throw new Error(messages[body.code] || genericError);
    }
    return body;
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-quest-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.questAction;
    if (action === 'withdraw' && !window.confirm(root.dataset.confirmWithdraw)) return;

    const itemId = button.dataset.itemId;
    const submissionId = button.dataset.submissionId;
    const endpoints = {
      claim: [`/api/v1/quests/${questId}/items/${itemId}/claim`, 'POST'],
      release: [`/api/v1/quests/${questId}/items/${itemId}/claim`, 'DELETE'],
      submit: [`/api/v1/quests/submissions/${submissionId}/submit`, 'POST'],
      withdraw: [`/api/v1/quests/submissions/${submissionId}/withdraw`, 'POST'],
      reopen: [`/api/v1/quests/submissions/${submissionId}/reopen`, 'POST'],
      revision: [`/api/v1/quests/submissions/${submissionId}/revision`, 'POST']
    };
    const endpoint = endpoints[action];
    if (!endpoint) return;

    button.disabled = true;
    try {
      const result = await mutate(...endpoint);
      const block = result.submission?.block;
      if ((action === 'reopen' || action === 'revision') && block) {
        window.location.assign(`/rooms/${block.roomId}/blocks/${block.id}/edit`);
      } else {
        window.location.reload();
      }
    } catch (error) {
      window.alert(error.message || genericError);
      button.disabled = false;
    }
  });
});
