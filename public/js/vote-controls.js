document.addEventListener("DOMContentLoaded", () => {
  const voteControls = document.querySelectorAll(".vote-controls");

  voteControls.forEach((control) => {
    const upvoteButton = control.querySelector(".vote-arrow.up");
    const downvoteButton = control.querySelector(".vote-arrow.down");
    const voteCountElement = control.querySelector(".vote-count");
    let voteCount = parseInt(voteCountElement.textContent);

    upvoteButton.addEventListener("click", () => {
      voteCount++;
      voteCountElement.textContent = voteCount;
      highlightVote(upvoteButton, downvoteButton);
    });

    downvoteButton.addEventListener("click", () => {
      voteCount--;
      voteCountElement.textContent = voteCount;
      highlightVote(downvoteButton, upvoteButton);
    });
  });

  function highlightVote(activeButton, otherButton) {
    activeButton.style.color = "#007bff";
    otherButton.style.color = "";
  }
});
