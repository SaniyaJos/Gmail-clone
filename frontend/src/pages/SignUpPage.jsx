import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import { authApi } from '../services/api';
import '../styles/signup.css';

const USERNAME_REGEX = /^[a-zA-Z0-9.]+$/;

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

export default function SignUpPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors
  const [firstNameError, setFirstNameError] = useState('');
  const [dobMonthError, setDobMonthError] = useState('');
  const [dobDayError, setDobDayError] = useState('');
  const [dobYearError, setDobYearError] = useState('');
  const [dobGeneralError, setDobGeneralError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step metadata
  const stepTitles = {
    1: { title: 'Create an InboxFlow Account', subtitle: 'Enter your name' },
    2: { title: 'Basic information', subtitle: 'Enter your birthday' },
    'age-error': { title: "Couldn't create account", subtitle: 'You do not meet the minimum age requirement' },
    3: { title: 'Choose your InboxFlow address', subtitle: 'Choose an InboxFlow username' },
    4: { title: 'Create a strong password', subtitle: 'Choose your password' }
  };

  const currentMeta = stepTitles[step] || stepTitles[1];

  // Validation functions
  const validateFirstName = () => {
    if (!firstName.trim()) {
      setFirstNameError('Enter first name');
      return false;
    }
    setFirstNameError('');
    return true;
  };

  const validateDOB = () => {
    let isValid = true;
    setDobMonthError('');
    setDobDayError('');
    setDobYearError('');
    setDobGeneralError('');

    if (dobMonth === '') {
      setDobMonthError('Select month');
      isValid = false;
    }

    if (!dobDay.trim()) {
      setDobDayError('Enter day');
      isValid = false;
    } else {
      const dayNum = parseInt(dobDay.trim(), 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
        setDobDayError('Enter a valid day');
        isValid = false;
      }
    }

    if (!dobYear.trim()) {
      setDobYearError('Enter year');
      isValid = false;
    } else {
      const yearNum = parseInt(dobYear.trim(), 10);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 10) {
        setDobYearError('Enter a valid year');
        isValid = false;
      }
    }

    if (!isValid) return false;

    const day = parseInt(dobDay.trim(), 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear.trim(), 10);
    const dateObj = new Date(year, month, day);

    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
      setDobGeneralError('Please enter a valid date');
      return false;
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    if (dateObj >= currentDate) {
      setStep('age-error');
      return false;
    }

    return true;
  };

  const validateAndCheckUsername = async () => {
    const val = username.trim();
    if (!val) {
      setUsernameError('Choose an InboxFlow address');
      return false;
    }
    if (!USERNAME_REGEX.test(val)) {
      setUsernameError('Sorry, only letters (a-z), numbers (0-9), and periods (.) are allowed.');
      return false;
    }

    setIsCheckingUsername(true);
    try {
      const data = await authApi.checkUsername(`${val.toLowerCase()}@flow.com`);
      if (data.exists) {
        setUsernameError('This Email ID is already taken');
        return false;
      }
    } catch (err) {
      console.warn('Backend username check error:', err);
    } finally {
      setIsCheckingUsername(false);
    }

    setUsernameError('');
    return true;
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordError('Enter a password');
      return false;
    }
    const strength = evaluatePassword(password);
    if (strength.score < 2) {
      setPasswordError('Use 8 characters or more for your password');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = () => {
    if (!confirmPassword) {
      setConfirmPasswordError('Confirm your password');
      return false;
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError("Those passwords didn't match. Try again.");
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isPassValid = validatePassword();
    const isConfValid = validateConfirmPassword();

    if (!isPassValid || !isConfValid) return;

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: `${username.trim().toLowerCase()}@flow.com`,
      password,
      dobDay: parseInt(dobDay.trim(), 10),
      dobMonth: parseInt(dobMonth, 10),
      dobYear: parseInt(dobYear.trim(), 10)
    };

    setIsSubmitting(true);
    try {
      await authApi.signUp(payload);
      try {
        const emailKey = payload.email.toLowerCase();
        localStorage.setItem(`inboxflow-new-signup:${emailKey}`, 'true');
        localStorage.setItem(`inboxflow-new-signup:${encodeURIComponent(emailKey)}`, 'true');
        localStorage.setItem(`inboxflow-first-signin:${emailKey}`, 'true');
      } catch (_) {}
      alert(`Account created successfully!\nEmail: ${payload.email}\nYou can now sign in.`);
      navigate('/signin');
    } catch (err) {
      console.error('Signup failed:', err);
      setUsernameError(err.data?.message || err.message || 'Signup failed. Please try again.');
      setStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = password ? evaluatePassword(password) : null;

  return (
    <div className="auth-page-container">
      <ThemeToggle className="page-theme-toggle" />
      <div className="signup-wrapper">
        <div className="signup-card">
          <div className="card-left">
            <div className="logo-container">
              <img src="/images/inboxflow.svg" alt="InboxFlow Logo" className="gmail-logo" />
            </div>
            <h1 className="card-title">{currentMeta.title}</h1>
            <p className="card-subtitle">{currentMeta.subtitle}</p>
          </div>

          <div className="card-right">
            <form id="signup-form" noValidate onSubmit={handleSubmit}>
              {/* Step 1: Name */}
              {step === 1 && (
                <div className="form-step active" id="step-1">
                  <div className="form-row">
                    <div className={`input-group ${firstNameError ? 'invalid' : ''}`}>
                      <input
                        type="text"
                        id="first-name"
                        required
                        placeholder=" "
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          if (firstNameError) setFirstNameError('');
                        }}
                      />
                      <label htmlFor="first-name">First name</label>
                      <div className="error-msg" id="first-name-error">{firstNameError}</div>
                    </div>
                    <div className="input-group">
                      <input
                        type="text"
                        id="last-name"
                        placeholder=" "
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                      <label htmlFor="last-name">Last name (optional)</label>
                    </div>
                  </div>
                  <div className="form-actions">
                    <Link to="/signin" className="btn-back">Sign in</Link>
                    <button
                      type="button"
                      className="btn-next"
                      id="btn-step-1-next"
                      onClick={() => {
                        if (validateFirstName()) setStep(2);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Date of Birth */}
              {step === 2 && (
                <div className="form-step active" id="step-2">
                  <div className="form-row">
                    <div className={`input-group dob-month-group ${dobMonthError ? 'invalid' : ''}`}>
                      <select
                        id="dob-month"
                        required
                        className={dobMonth !== '' ? 'has-value' : ''}
                        value={dobMonth}
                        onChange={(e) => {
                          setDobMonth(e.target.value);
                          if (dobMonthError) setDobMonthError('');
                        }}
                      >
                        <option value="" disabled hidden></option>
                        <option value="0">January</option>
                        <option value="1">February</option>
                        <option value="2">March</option>
                        <option value="3">April</option>
                        <option value="4">May</option>
                        <option value="5">June</option>
                        <option value="6">July</option>
                        <option value="7">August</option>
                        <option value="8">September</option>
                        <option value="9">October</option>
                        <option value="10">November</option>
                        <option value="11">December</option>
                      </select>
                      <label htmlFor="dob-month">Month</label>
                      <div className="error-msg" id="dob-month-error">{dobMonthError}</div>
                    </div>

                    <div className={`input-group dob-day-group ${dobDayError ? 'invalid' : ''}`}>
                      <input
                        type="number"
                        id="dob-day"
                        required
                        placeholder=" "
                        min="1"
                        max="31"
                        value={dobDay}
                        onChange={(e) => {
                          setDobDay(e.target.value);
                          if (dobDayError) setDobDayError('');
                          if (dobGeneralError) setDobGeneralError('');
                        }}
                      />
                      <label htmlFor="dob-day">Day</label>
                      <div className="error-msg" id="dob-day-error">{dobDayError}</div>
                    </div>

                    <div className={`input-group dob-year-group ${dobYearError ? 'invalid' : ''}`}>
                      <input
                        type="number"
                        id="dob-year"
                        required
                        placeholder=" "
                        min="1900"
                        max="2099"
                        value={dobYear}
                        onChange={(e) => {
                          setDobYear(e.target.value);
                          if (dobYearError) setDobYearError('');
                          if (dobGeneralError) setDobGeneralError('');
                        }}
                      />
                      <label htmlFor="dob-year">Year</label>
                      <div className="error-msg" id="dob-year-error">{dobYearError}</div>
                    </div>
                  </div>
                  <div className="error-msg" id="dob-general-error">{dobGeneralError}</div>
                  <div className="form-actions">
                    <button type="button" className="btn-back" id="btn-step-2-back" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn-next"
                      id="btn-step-2-next"
                      onClick={() => {
                        if (validateDOB()) setStep(3);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Age Error */}
              {step === 'age-error' && (
                <div className="form-step active" id="step-age-error">
                  <div className="age-error-container">
                    <p className="age-error-text">
                      You cannot create an InboxFlow Account because you do not meet the minimum age requirement.
                    </p>
                  </div>
                  <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                    <button type="button" className="btn-back" id="btn-age-error-back" onClick={() => setStep(2)}>
                      Go back
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Username */}
              {step === 3 && (
                <div className="form-step active" id="step-3">
                  <div className={`input-group full-width username-group ${usernameError ? 'invalid' : ''}`}>
                    <div className="username-wrapper">
                      <input
                        type="text"
                        id="username"
                        required
                        placeholder=" "
                        autoComplete="username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (usernameError) setUsernameError('');
                        }}
                      />
                      <label htmlFor="username">Username</label>
                      <span className="gmail-domain">@flow.com</span>
                    </div>
                    <div className="input-info">You can use letters, numbers & periods</div>
                    <div className="error-msg" id="username-error">{usernameError}</div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-back" id="btn-step-3-back" onClick={() => setStep(2)}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn-next"
                      id="btn-step-3-next"
                      disabled={isCheckingUsername}
                      onClick={async () => {
                        const valid = await validateAndCheckUsername();
                        if (valid) setStep(4);
                      }}
                    >
                      {isCheckingUsername ? 'Checking...' : 'Next'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Password & Confirm */}
              {step === 4 && (
                <div className="form-step active" id="step-4">
                  <div className="form-row password-row">
                    <div className={`input-group password-toggle-group ${passwordError ? 'invalid' : ''}`}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        required
                        placeholder=" "
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (passwordError) setPasswordError('');
                        }}
                      />
                      <label htmlFor="password">Password</label>
                      <img
                        src={showPassword ? '/images/eye-regular-full.svg' : '/images/eye-slash-regular-full.svg'}
                        alt={showPassword ? 'Hide Password' : 'Show Password'}
                        className="password-toggle-icon"
                        id="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                      />
                      <div className="error-msg" id="password-error">{passwordError}</div>
                    </div>

                    <div className={`input-group password-toggle-group ${confirmPasswordError ? 'invalid' : ''}`}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirm-password"
                        required
                        placeholder=" "
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (confirmPasswordError) setConfirmPasswordError('');
                        }}
                      />
                      <label htmlFor="confirm-password">Confirm</label>
                      <img
                        src={showConfirmPassword ? '/images/eye-regular-full.svg' : '/images/eye-slash-regular-full.svg'}
                        alt={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                        className="password-toggle-icon"
                        id="toggle-confirm-password"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                      <div className="error-msg" id="confirm-password-error">{confirmPasswordError}</div>
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {strength && (
                    <div className="strength-container" id="strength-container" style={{ display: 'flex' }}>
                      <div className="strength-bar-wrapper">
                        <div
                          className="strength-bar"
                          id="strength-bar"
                          style={{ width: strength.width, backgroundColor: strength.color }}
                        />
                      </div>
                      <span className="strength-text" id="strength-text" style={{ color: strength.color }}>
                        Password strength: {strength.label}
                      </span>
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="button" className="btn-back" id="btn-step-4-back" onClick={() => setStep(3)}>
                      Back
                    </button>
                    <button type="submit" className="btn-next" id="btn-submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
