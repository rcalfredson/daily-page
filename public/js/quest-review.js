document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-quest-review]');
  if (!root) return;

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('.quest-review-form');
    if (!form) return;
    event.preventDefault();
    const action = event.submitter?.dataset.reviewAction;
    if (!['approve', 'request-changes', 'reject'].includes(action)) return;

    const comment = String(new FormData(form).get('comment') || '').trim();
    if (action !== 'approve' && !comment) {
      window.alert(root.dataset.commentRequired);
      return;
    }

    const buttons = [...form.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const response = await fetch(
        `/api/v1/quests/submissions/${form.dataset.submissionId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: comment || null })
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const staleCodes = new Set([
          'QUEST_SUBMISSION_BLOCK_CHANGED',
          'QUEST_SUBMISSION_BLOCK_INELIGIBLE',
          'QUEST_SUBMISSION_INVALID_STATE'
        ]);
        const error = new Error(
          staleCodes.has(body.code) ? root.dataset.staleError : root.dataset.genericError
        );
        error.stale = staleCodes.has(body.code);
        throw error;
      }
      window.location.reload();
    } catch (error) {
      window.alert(error.message || root.dataset.genericError);
      if (error.stale) {
        window.location.reload();
        return;
      }
      buttons.forEach(button => { button.disabled = false; });
    }
  });
});
