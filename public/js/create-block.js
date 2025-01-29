document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("block-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0); // Convert tags to an array

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create block");

      const block = await response.json();
      window.location.href = `/rooms/${block.roomId}/blocks/${block._id}`; // Redirect to block editor
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong. Please try again.");
    }
  });
});
