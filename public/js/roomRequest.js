document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('roomRequestForm');
  const feedback = document.querySelector('.form-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default form submission

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // Send AJAX request
      const response = await fetch('/request-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Show success feedback
        feedback.textContent = 'Request submitted successfully!';
        feedback.style.display = 'block';
        feedback.style.color = 'green';
        form.reset(); // Clear the form
      } else {
        // Show error feedback
        feedback.textContent = 'Failed to submit request. Please try again.';
        feedback.style.display = 'block';
        feedback.style.color = 'red';
      }
    } catch (error) {
      // Show error feedback
      feedback.textContent = 'An unexpected error occurred. Please try again.';
      feedback.style.display = 'block';
      feedback.style.color = 'red';
    }
  });
});
