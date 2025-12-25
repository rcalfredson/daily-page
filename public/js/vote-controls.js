// public/js/vote-controls.js
document.addEventListener("DOMContentLoaded", () => {
  const voteControls = document.querySelectorAll(".vote-controls");

  voteControls.forEach((control) => {
    const upvoteButton = control.querySelector(".vote-arrow.up");
    const downvoteButton = control.querySelector(".vote-arrow.down");
    const voteCountElement = control.querySelector(".vote-count");
    const userVote = control.dataset.userVote;

    if (userVote === 'upvote') {
      upvoteButton.style.color = "#4194ed";
    } else if (userVote === 'downvote') {
      downvoteButton.style.color = "#4194ed";
    }

    upvoteButton.addEventListener("click", () =>
      handleVote("upvote", voteCountElement, control.dataset.blockId, control)
    );
    downvoteButton.addEventListener("click", () =>
      handleVote("downvote", voteCountElement, control.dataset.blockId, control)
    );
  });

  async function handleVote(action, voteCountElement, blockId, control) {
    const isLoggedIn = checkLoginState();
    const failMsg = control?.dataset.voteFailed || 'Failed to save your vote.';
    if (!isLoggedIn) {
      showLoginModal("actions.voteOnBlock");
      return;
    }

    try {
      const response = await fetch(`/api/v1/votes/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(failMsg);
      }

      const data = await response.json();
      voteCountElement.textContent = data.voteCount;

      // Get the parent vote controls
      const container = voteCountElement.closest(".vote-controls");
      const upvoteButton = container.querySelector(".vote-arrow.up");
      const downvoteButton = container.querySelector(".vote-arrow.down");

      // Reset styles first
      upvoteButton.style.color = "";
      downvoteButton.style.color = "";

      // Apply color to the selected vote
      if (action === "upvote") {
        upvoteButton.style.color = "#4194ed";
      } else if (action === "downvote") {
        downvoteButton.style.color = "#4194ed";
      }

    } catch (error) {
      console.error('Error submitting vote:', error);
      showToast?.(failMsg, 'error');
    }
  }

  function checkLoginState() {
    return document.body.dataset.isLoggedIn === "true";
  }

  function showLoginModal(actionType) {
    const modal = document.getElementById("login-modal");
    const modalMessage = document.getElementById("login-modal-message");
    if (!modal || !modalMessage) return;

    let msg = 'Please log in to perform this action.';

    if (typeof window.i18nT === 'function') {
      // actionType es algo como "actions.voteOnBlock" o "actions.starRoom"
      const actionKey = `modals.${actionType}`;
      let actionText = i18nT(actionKey);

      if (!actionText || actionText === actionKey) {
        // Fallback genérico si falta la traducción específica de la acción
        actionText = 'this action';
      }

      const msgKey = 'modals.login.messageWithAction';
      const maybeMsg = i18nT(msgKey, { action: actionText });

      if (maybeMsg && maybeMsg !== msgKey) {
        msg = maybeMsg;
      } else {
        msg = `Please log in to ${actionText}.`;
      }
    }

    modalMessage.textContent = msg;
    modal.classList.remove('hidden');
  }

  window.showLoginModal = showLoginModal;
});
