/* JavaScript for Gmail Clone Signup Page Validation and API Integration */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. CONFIGURATION & STEP DEFINITIONS
  // ==========================================
  const API_BASE = 'http://localhost:5000/api';

  // Allowed username pattern: letters, numbers, and periods only
  const usernameRegex = /^[a-zA-Z0-9.]+$/;

  // Multi-step configuration map
  const steps = {
    1: {
      el: document.getElementById('step-1'),
      title: 'Create an InboxFlow Account',
      subtitle: 'Enter your name'
    },
    2: {
      el: document.getElementById('step-2'),
      title: 'Basic information',
      subtitle: 'Enter your birthday'
    },
    'age-error': {
      el: document.getElementById('step-age-error'),
      title: "Couldn't create account",
      subtitle: 'You do not meet the minimum age requirement'
    },
    3: {
      el: document.getElementById('step-3'),
      title: 'Choose your InboxFlow address',
      subtitle: 'Choose an InboxFlow username'
    },
    4: {
      el: document.getElementById('step-4'),
      title: 'Create a strong password',
      subtitle: 'Choose your password'
    }
  };

  // ==========================================
  // 2. DOM ELEMENT SELECTORS
  // ==========================================
  const form = document.getElementById('signup-form');
  const firstNameInput = document.getElementById('first-name');
  const lastNameInput = document.getElementById('last-name');
  const dobMonthSelect = document.getElementById('dob-month');
  const dobDayInput = document.getElementById('dob-day');
  const dobYearInput = document.getElementById('dob-year');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');

  // Error containers
  const firstNameError = document.getElementById('first-name-error');
  const usernameError = document.getElementById('username-error');
  const passwordError = document.getElementById('password-error');
  const confirmPasswordError = document.getElementById('confirm-password-error');

  // Password strength elements
  const strengthContainer = document.getElementById('strength-container');
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');

  // Password visibility toggle icons
  const togglePassword = document.getElementById('toggle-password');
  const toggleConfirmPassword = document.getElementById('toggle-confirm-password');

  // ==========================================
  // 3. UI HELPERS & STEP NAVIGATION
  // ==========================================

  function showError(input, errorElement, message) {
    input.parentElement.classList.add('invalid');
    errorElement.textContent = message;
  }

  function clearError(input, errorElement) {
    input.parentElement.classList.remove('invalid');
    if (errorElement) {
      errorElement.textContent = '';
    }
  }

  // Switch active wizard step
  function showStep(stepKey) {
    Object.values(steps).forEach(s => {
      s.el.style.display = 'none';
      s.el.classList.remove('active');
    });

    const target = steps[stepKey];
    if (target) {
      target.el.style.display = 'block';
      target.el.classList.add('active');

      document.querySelector('.card-title').textContent = target.title;
      document.querySelector('.card-subtitle').textContent = target.subtitle;
    }
  }

  // ==========================================
  // 4. PASSWORD STRENGTH & VISIBILITY
  // ==========================================

  function setupPasswordToggle(toggleIcon, inputField) {
    toggleIcon.addEventListener('click', () => {
      const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
      inputField.setAttribute('type', type);
      toggleIcon.src = type === 'password' ? 'images/eye-slash-regular-full.svg' : 'images/eye-regular-full.svg';
      toggleIcon.alt = type === 'password' ? 'Show Password' : 'Hide Password';
    });
  }

  setupPasswordToggle(togglePassword, passwordInput);
  setupPasswordToggle(toggleConfirmPassword, confirmPasswordInput);

  function evaluatePassword(pwd) {
    if (pwd.length < 8) {
      return { score: 1, label: 'Poor (too short, min 8 characters)', color: 'var(--color-strength-poor)', width: '25%' };
    }

    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);

    if ((hasLetters && !hasNumbers && !hasSpecial) || (!hasLetters && hasNumbers && !hasSpecial)) {
      return { score: 2, label: 'Medium (mix letters and numbers for stronger security)', color: 'var(--color-strength-good)', width: '50%' };
    }

    if (hasLower && hasUpper && hasNumbers && hasSpecial) {
      return { score: 4, label: 'Strong', color: 'var(--color-strength-strong)', width: '100%' };
    }

    return { score: 3, label: 'Good', color: 'var(--color-strength-good)', width: '75%' };
  }

  function updateStrengthUI(strength) {
    strengthBar.style.width = strength.width;
    strengthBar.style.backgroundColor = strength.color;
    strengthText.textContent = `Password strength: ${strength.label}`;
    strengthText.style.color = strength.color;
  }

  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    if (val === '') {
      strengthContainer.style.display = 'none';
      return;
    }
    strengthContainer.style.display = 'flex';
    const strength = evaluatePassword(val);
    updateStrengthUI(strength);
  });

  // ==========================================
  // 5. FIELD VALIDATORS
  // ==========================================

  function validateFirstName() {
    const val = firstNameInput.value.trim();
    if (val === '') {
      showError(firstNameInput, firstNameError, 'Enter first name');
      return false;
    }
    clearError(firstNameInput, firstNameError);
    return true;
  }

  function validateDOB() {
    const monthVal = dobMonthSelect.value;
    const dayVal = dobDayInput.value.trim();
    const yearVal = dobYearInput.value.trim();

    let isValid = true;
    const monthErr = document.getElementById('dob-month-error');
    const dayErr = document.getElementById('dob-day-error');
    const yearErr = document.getElementById('dob-year-error');
    const generalErr = document.getElementById('dob-general-error');

    clearError(dobMonthSelect, monthErr);
    clearError(dobDayInput, dayErr);
    clearError(dobYearInput, yearErr);
    generalErr.textContent = '';

    if (monthVal === '') {
      showError(dobMonthSelect, monthErr, 'Select month');
      isValid = false;
    }

    if (dayVal === '') {
      showError(dobDayInput, dayErr, 'Enter day');
      isValid = false;
    } else {
      const dayNum = parseInt(dayVal, 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        showError(dobDayInput, dayErr, 'Enter a valid day');
        isValid = false;
      }
    }

    if (yearVal === '') {
      showError(dobYearInput, yearErr, 'Enter year');
      isValid = false;
    } else {
      const yearNum = parseInt(yearVal, 10);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 10) {
        showError(dobYearInput, yearErr, 'Enter a valid year');
        isValid = false;
      }
    }

    if (!isValid) return false;

    // Check calendar date validity
    const day = parseInt(dayVal, 10);
    const month = parseInt(monthVal, 10);
    const year = parseInt(yearVal, 10);
    const dateObj = new Date(year, month, day);

    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
      generalErr.textContent = 'Please enter a valid date';
      return false;
    }

    // Age validation: check if DOB is in the future
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    if (dateObj >= currentDate) {
      showStep('age-error');
      return false;
    }

    return true;
  }

  async function validateAndCheckUsername() {
    const val = usernameInput.value.trim();
    if (val === '') {
      showError(usernameInput, usernameError, 'Choose an InboxFlow address');
      return false;
    }
    if (!usernameRegex.test(val)) {
      showError(usernameInput, usernameError, 'Sorry, only letters (a-z), numbers (0-9), and periods (.) are allowed.');
      return false;
    }

    const checkBtn = document.getElementById('btn-step-3-next');
    checkBtn.textContent = 'Checking...';
    checkBtn.disabled = true;

    try {
      // Connect to Express Endpoint to verify username availability
      const response = await fetch(`${API_BASE}/check-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: `${val.toLowerCase()}@flow.com` })
      });

      if (!response.ok) {
        throw new Error('Check username endpoint returned error');
      }

      const data = await response.json();
      if (data.exists) {
        showError(usernameInput, usernameError, 'This Email ID is already taken');
        checkBtn.textContent = 'Next';
        checkBtn.disabled = false;
        return false;
      }
    } catch (err) {
      console.warn('Backend username check offline, simulating verification:', err);
      const dummyTakenUsernames = ['admin', 'taken', 'saniya.test', 'test'];
      if (dummyTakenUsernames.includes(val.toLowerCase())) {
        showError(usernameInput, usernameError, 'This Email ID is already taken');
        checkBtn.textContent = 'Next';
        checkBtn.disabled = false;
        return false;
      }
    }

    checkBtn.textContent = 'Next';
    checkBtn.disabled = false;
    clearError(usernameInput, usernameError);
    return true;
  }

  function validatePassword() {
    const val = passwordInput.value;
    if (val === '') {
      showError(passwordInput, passwordError, 'Enter a password');
      return false;
    }
    const strength = evaluatePassword(val);
    if (strength.score < 2) {
      showError(passwordInput, passwordError, 'Use 8 characters or more for your password');
      return false;
    }
    clearError(passwordInput, passwordError);
    return true;
  }

  function validateConfirmPassword() {
    const val = confirmPasswordInput.value;
    const pwdVal = passwordInput.value;
    if (val === '') {
      showError(confirmPasswordInput, confirmPasswordError, 'Confirm your password');
      return false;
    }
    if (val !== pwdVal) {
      showError(confirmPasswordInput, confirmPasswordError, "Those passwords didn't match. Try again.");
      return false;
    }
    clearError(confirmPasswordInput, confirmPasswordError);
    return true;
  }

  // Real-time input listeners to clear errors on typing
  firstNameInput.addEventListener('input', validateFirstName);
  usernameInput.addEventListener('input', () => {
    if (usernameInput.value.trim() !== '') {
      clearError(usernameInput, usernameError);
    }
  });
  passwordInput.addEventListener('input', validatePassword);
  confirmPasswordInput.addEventListener('input', validateConfirmPassword);

  dobMonthSelect.addEventListener('change', () => {
    if (dobMonthSelect.value !== '') {
      dobMonthSelect.classList.add('has-value');
      clearError(dobMonthSelect, document.getElementById('dob-month-error'));
    } else {
      dobMonthSelect.classList.remove('has-value');
    }
  });

  dobDayInput.addEventListener('input', () => {
    if (dobDayInput.value.trim() !== '') {
      clearError(dobDayInput, document.getElementById('dob-day-error'));
    }
    document.getElementById('dob-general-error').textContent = '';
  });

  dobYearInput.addEventListener('input', () => {
    if (dobYearInput.value.trim() !== '') {
      clearError(dobYearInput, document.getElementById('dob-year-error'));
    }
    document.getElementById('dob-general-error').textContent = '';
  });

  // ==========================================
  // 6. STEP BUTTON NAVIGATION HANDLERS
  // ==========================================

  // Step 1: Name -> Step 2
  document.getElementById('btn-step-1-next').addEventListener('click', () => {
    if (validateFirstName()) {
      showStep(2);
    }
  });

  // Step 2: Birthday -> Step 1 / Step 3
  document.getElementById('btn-step-2-back').addEventListener('click', () => {
    showStep(1);
  });

  document.getElementById('btn-step-2-next').addEventListener('click', () => {
    if (validateDOB()) {
      showStep(3);
    }
  });

  // Age Error Back Button
  document.getElementById('btn-age-error-back').addEventListener('click', () => {
    showStep(2);
  });

  // Step 3: Username -> Step 2 / Step 4
  document.getElementById('btn-step-3-back').addEventListener('click', () => {
    showStep(2);
  });

  document.getElementById('btn-step-3-next').addEventListener('click', async () => {
    const isUsernameValid = await validateAndCheckUsername();
    if (isUsernameValid) {
      showStep(4);
    }
  });

  // Step 4: Password -> Step 3
  document.getElementById('btn-step-4-back').addEventListener('click', () => {
    showStep(3);
  });

  // ==========================================
  // 7. FINAL FORM SUBMIT & ACCOUNT CREATION
  // ==========================================

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isPassValid = validatePassword();
    const isConfValid = validateConfirmPassword();

    if (!isPassValid || !isConfValid) {
      return;
    }

    const payload = {
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      email: `${usernameInput.value.trim().toLowerCase()}@flow.com`,
      password: passwordInput.value,
      dobDay: parseInt(dobDayInput.value.trim(), 10),
      dobMonth: parseInt(dobMonthSelect.value, 10),
      dobYear: parseInt(dobYearInput.value.trim(), 10)
    };

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        try {
          localStorage.setItem(`inboxflow-new-signup:${payload.email.toLowerCase()}`, 'true');
        } catch (_) {}
        alert(`Account created successfully!\nEmail: ${payload.email}\nYou can now sign in.`);
        window.location.href = 'signin.html';
      } else {
        showError(usernameInput, usernameError, data.message || 'Signup failed. Please try again.');
        showStep(3);
        submitBtn.textContent = 'Create';
        submitBtn.disabled = false;
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
      alert(`Database/Server Connection Offline!\n\nSimulated Account creation:\nName: ${payload.firstName}\nEmail: ${payload.email}\n\n(To save to MongoDB, start the Express backend in backend/ directory)`);
      window.location.href = 'signin.html';
    }
  });

});
