document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');
  const feedback = document.querySelector('.form-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent the default form submission

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // Send AJAX request
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Show success feedback
        feedback.textContent = 'Account created successfully! Please check your email to verify your account.';
        feedback.style.display = 'block';
        feedback.style.color = 'green';
        form.reset(); // Reset the form fields
      } else {
        // Handle failure (e.g., validation errors)
        const errorData = await response.json();
        feedback.textContent = errorData.error || 'Failed to create account. Please try again.';
        feedback.style.display = 'block';
        feedback.style.color = 'red';
      }
    } catch (error) {
      // Handle unexpected errors
      feedback.textContent = 'An unexpected error occurred. Please try again.';
      feedback.style.display = 'block';
      feedback.style.color = 'red';
    }
  });
});
