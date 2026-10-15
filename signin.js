/* JavaScript for Gmail Clone Sign-in Validation and API Integration */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. CONFIGURATION & DOM SELECTORS
  // ==========================================
  const API_BASE = 'http://localhost:5000/api';

  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('btn-submit');

  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const togglePassword = document.getElementById('toggle-password');

  // ==========================================
  // 2. UI HELPER FUNCTIONS
  // ==========================================

  function showError(input, errorElement, message) {
    input.parentElement.classList.add('invalid');
    errorElement.textContent = message;
  }

  function clearError(input, errorElement) {
    input.parentElement.classList.remove('invalid');
    errorElement.textContent = '';
  }

  // ==========================================
  // 3. INPUT EVENT LISTENERS
  // ==========================================

  // Toggle Password visibility
  togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    togglePassword.src = isPassword ? 'images/eye-slash-regular-full.svg' : 'images/eye-regular-full.svg';
    togglePassword.alt = isPassword ? 'Show Password' : 'Hide Password';
  });

  // Real-time validation error clearers
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

  // ==========================================
  // 4. FORM SUBMIT & AUTHENTICATION HANDLER
  // ==========================================

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

    // Normalize email: If user enters just "saniya.test", append "@flow.com"
    let formattedEmail = emailVal.toLowerCase();
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@flow.com`;
    }

    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;

    try {
      // Connect to Express Sign-in Endpoint
      const response = await fetch(`${API_BASE}/signin`, {
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
        window.location.href = 'inbox.html';
      } else {
        // If login failed, highlight the relevant field
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

      // Offline simulation fallback for testing
      alert(`Database/Server Connection Offline!\n\nSimulated Login:\nEmail: ${formattedEmail}\n\n(Ensure your backend server is running to sign in dynamically)`);

      localStorage.setItem('currentUser', JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: formattedEmail
      }));

      window.location.href = 'inbox.html';
    }
  });

});
