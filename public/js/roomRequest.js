document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('roomRequestForm');
  const feedback = document.querySelector('.form-feedback');
  if (!form || !feedback) return;

  const MSG_SUCCESS = feedback.dataset.msgSuccess || 'Request submitted successfully!';
  const MSG_ERROR = feedback.dataset.msgError || 'Failed to submit request. Please try again.';
  const MSG_UNEXPECTED = feedback.dataset.msgUnexpected || 'An unexpected error occurred. Please try again.';

  function showFeedback(message, color) {
    feedback.textContent = message;
    feedback.style.display = 'block';
    feedback.style.color = color;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/request-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        showFeedback(MSG_SUCCESS, 'green');
        form.reset();
      } else {
        showFeedback(MSG_ERROR, 'red');
      }
    } catch (error) {
      showFeedback(MSG_UNEXPECTED, 'red');
    }
  });
});
