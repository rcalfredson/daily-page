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

    upvoteButton.addEventListener("click", () => handleVote("upvote", voteCountElement, control.dataset.blockId));
    downvoteButton.addEventListener("click", () => handleVote("downvote", voteCountElement, control.dataset.blockId));
  });

  async function handleVote(action, voteCountElement, blockId) {
    const isLoggedIn = checkLoginState();
    if (!isLoggedIn) {
      showLoginModal("vote on a block");
      return;
    }
    try {
      const response = await fetch(`/api/v1/votes/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error('Failed to save vote');
      }

      const data = await response.json();
      voteCountElement.textContent = data.voteCount;

      // Get the parent vote controls
      const control = voteCountElement.closest(".vote-controls");
      const upvoteButton = control.querySelector(".vote-arrow.up");
      const downvoteButton = control.querySelector(".vote-arrow.down");

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
    }
  }

  function checkLoginState() {
    return document.body.dataset.isLoggedIn === "true";
  }

  function showLoginModal(actionType) {
    const modal = document.getElementById("login-modal");
    const modalMessage = document.getElementById("login-modal-message");
    modalMessage.textContent = `You need to be logged in to ${actionType}.`;

    modal.style.display = "block";

    const closeBtn = modal.querySelector(".modal-close");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  }
  window.showLoginModal = showLoginModal;
});
