/* JavaScript for Gmail Clone Sign-in validation and API Integration */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  // Error containers
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');

  // Password toggle elements
  const togglePassword = document.getElementById('toggle-password');

  // Toggle Password visibility
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    if (type === 'password') {
      togglePassword.src = 'images/eye-slash-regular-full.svg';
      togglePassword.alt = 'Show Password';
    } else {
      togglePassword.src = 'images/eye-regular-full.svg';
      togglePassword.alt = 'Hide Password';
    }
  });

  // Real-time validation clearers
  emailInput.addEventListener('input', () => {
    if (emailInput.value.trim() !== '') {
      clearError(emailInput, emailError);
    }
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.value !== '') {
      clearError(passwordInput, passwordError);
    }
  });

  function showError(input, errorElement, message) {
    input.parentElement.classList.add('invalid');
    errorElement.textContent = message;
  }

  function clearError(input, errorElement) {
    input.parentElement.classList.remove('invalid');
    errorElement.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailVal = emailInput.value.trim();
    const passwordVal = passwordInput.value;

    let isValid = true;

    // Validate inputs
    if (emailVal === '') {
      showError(emailInput, emailError, 'Enter an email or username');
      isValid = false;
    }

    if (passwordVal === '') {
      showError(passwordInput, passwordError, 'Enter a password');
      isValid = false;
    }

    if (!isValid) return;

    // Normalize email: If user enters just "saniya.test", convert it to "saniya.test@gmail.com"
    let formattedEmail = emailVal.toLowerCase();
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@gmail.com`;
    }

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;

    try {
      // Connect to Express Sign-in Endpoint
      const response = await fetch('http://localhost:5000/api/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formattedEmail,
          password: passwordVal
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Save logged-in user details to localStorage
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        alert(`Welcome back, ${data.user.firstName}! Connecting to your inbox...`);
        window.location.href = 'inbox.html'; // Redirect to inbox dashboard
      } else {
        // If login failed, determine which field to highlight
        if (data.message.toLowerCase().includes('password')) {
          showError(passwordInput, passwordError, data.message);
        } else {
          showError(emailInput, emailError, data.message);
        }
        submitBtn.textContent = 'Next';
        submitBtn.disabled = false;
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
      // Fallback/Simulated login for testing
      alert(`Database/Server Connection Offline!\n\nSimulated Login:\nEmail: ${formattedEmail}\n\n(Ensure your backend server is running to sign in dynamically)`);

      // Simulate save and redirect for styling/ui flow testing
      localStorage.setItem('currentUser', JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: formattedEmail
      }));

      window.location.href = 'inbox.html';
    }
  });
});
