// Global variables to store the current tooltip anchor and option
let currentTooltipAnchor = null;
let currentTooltipOption = null;
let outsideClickListener = null; // We'll store a reference to the outside click listener

document.addEventListener("DOMContentLoaded", () => {
  // Dynamic placeholder adjustment for responsive design
  const titleInput = document.getElementById("title");
  const fullPlaceholder = "e.g. 'My Masterpiece', 'The Best Idea Ever', 'Clickbait for Nerds'";
  const shortPlaceholder = "e.g. 'My Masterpiece'";

  const updatePlaceholder = () => {
    if (window.innerWidth < 600) {
      titleInput.placeholder = shortPlaceholder;
    } else {
      titleInput.placeholder = fullPlaceholder;
    }
  };

  updatePlaceholder();
  window.addEventListener("resize", updatePlaceholder);

  // Existing form submission code
  const form = document.getElementById("block-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Extraer los tags desde el partial
    const tagContainer = document.getElementById('tag-container');
    let tagsArray = [];
    if (tagContainer) {
      const tagPills = tagContainer.querySelectorAll('.tag-pill');
      tagPills.forEach(pill => {
        // Asumimos que el contenido de la pill es el tag (sin el " x")
        tagsArray.push(pill.firstChild.textContent.trim());
      });
    }
    data.tags = tagsArray;

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create block");

      const block = await response.json();
      window.location.href = `/rooms/${block.roomId}/blocks/${block._id}/edit`; // Redirect to block editor
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong. Please try again.");
    }
  });
});

// Called when the user clicks the help icon
function toggleTooltip(event, option) {
  event.stopPropagation(); // Prevent immediate document click from closing the tooltip

  currentTooltipAnchor = event.target;  // The icon
  currentTooltipOption = option;

  let tooltip = document.getElementById(`${option}-tooltip`);

  // If the tooltip doesn't exist, create it
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = `${option}-tooltip`;
    tooltip.className = "tooltip";
    tooltip.textContent = "Private blocks are for logged-in users only. They remain hidden until editing is complete and come with a shareable link for invitations.";
    document.body.appendChild(tooltip);
  }

  // If it's currently hidden (or not set), show it; otherwise hide it
  if (tooltip.style.display !== "block") {
    showTooltip(tooltip);
  } else {
    hideTooltip(tooltip);
  }
}

// Show the tooltip and attach an outside-click listener
function showTooltip(tooltip) {
  tooltip.style.display = "block";
  positionTooltip(currentTooltipAnchor, tooltip);

  // Attach an outside-click listener to close the tooltip when clicking anywhere else
  outsideClickListener = function (e) {
    if (!tooltip.contains(e.target) && !currentTooltipAnchor.contains(e.target)) {
      hideTooltip(tooltip);
    }
  };
  // Use a small delay to avoid immediate hide
  setTimeout(() => document.addEventListener("click", outsideClickListener), 0);
}

// Hide the tooltip and remove the outside-click listener
function hideTooltip(tooltip) {
  tooltip.style.display = "none";
  if (outsideClickListener) {
    document.removeEventListener("click", outsideClickListener);
    outsideClickListener = null;
  }
}

// Position the tooltip relative to its anchor element
function positionTooltip(anchor, tooltip) {
  // Make sure tooltip is visible so we can measure its size
  tooltip.style.display = "block";
  
  // Get bounding rectangles
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // We’ll position the tooltip slightly below the icon
  const offsetY = 4; // You can tweak this
  let top = anchorRect.bottom + window.scrollY + offsetY;
  
  // Center it horizontally relative to the anchor
  let left = anchorRect.left + window.scrollX + (anchorRect.width / 2) - (tooltipRect.width / 2);

  // Prevent overflowing off the right side
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  // Prevent overflowing off the left side
  if (left < 10) {
    left = 10;
  }

  // Apply the final position
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.maxWidth = "280px";
}

// Reposition tooltip on window resize if it's visible
window.addEventListener("resize", () => {
  if (currentTooltipOption) {
    const tooltip = document.getElementById(`${currentTooltipOption}-tooltip`);
    if (tooltip && tooltip.style.display === "block") {
      positionTooltip(currentTooltipAnchor, tooltip);
    }
  }
});
