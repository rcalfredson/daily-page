document.addEventListener("DOMContentLoaded", () => {
  const voteControls = document.querySelectorAll(".vote-controls");

  voteControls.forEach((control) => {
    const upvoteButton = control.querySelector(".vote-arrow.up");
    const downvoteButton = control.querySelector(".vote-arrow.down");
    const voteCountElement = control.querySelector(".vote-count");

    upvoteButton.addEventListener("click", () => handleVote("upvote", voteCountElement));
    downvoteButton.addEventListener("click", () => handleVote("downvote", voteCountElement));
  });

  function handleVote(action, voteCountElement) {
    const isLoggedIn = checkLoginState();
    if (!isLoggedIn) {
      showLoginModal();
      return;
    }
    // Update vote count
    let voteCount = parseInt(voteCountElement.textContent);
    voteCount = action === "upvote" ? voteCount + 1 : voteCount - 1;
    voteCountElement.textContent = voteCount;
  }

  function checkLoginState() {
    console.log('doc body dataset?', document.body.dataset);
    return document.body.dataset.isLoggedIn === "true";
  }

  function showLoginModal() {
    const modal = document.getElementById("login-modal");
    const closeBtn = modal.querySelector(".modal-close");

    modal.style.display = "block";

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  }
});
