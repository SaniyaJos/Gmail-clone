import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import '../styles/signin.css';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailVal = email.trim();
    const passwordVal = password;

    let isValid = true;
    if (emailVal === '') {
      setEmailError('Enter an email or username');
      isValid = false;
    }
    if (passwordVal === '') {
      setPasswordError('Enter a password');
      isValid = false;
    }

    if (!isValid) return;

    let formattedEmail = emailVal.toLowerCase();
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@flow.com`;
    }

    setIsSubmitting(true);

    try {
      const data = await authApi.signIn(formattedEmail, passwordVal);
      login(data.user);
      alert(`Welcome back, ${data.user.firstName}! Connecting to your inbox...`);
      navigate('/inbox');
    } catch (err) {
      console.error('Error connecting to backend:', err);
      const msg = err.data?.message || err.message || 'Could not reach the backend.';
      if (msg.toLowerCase().includes('password')) {
        setPasswordError(msg);
      } else {
        setEmailError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <ThemeToggle className="page-theme-toggle" />
      <div className="signin-wrapper">
        <div className="signin-card">
          <div className="card-left">
            <div className="logo-container">
              <img src="/images/inboxflow.svg" alt="InboxFlow Logo" className="gmail-logo" />
            </div>
            <h1 className="card-title">Sign in</h1>
            <p className="card-subtitle">to continue to InboxFlow</p>
          </div>

          <div className="card-right">
            <form id="signin-form" noValidate onSubmit={handleSubmit}>
              <div className={`input-group full-width ${emailError ? 'invalid' : ''}`}>
                <input
                  type="text"
                  id="email"
                  required
                  placeholder=" "
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                />
                <label htmlFor="email">Email or username</label>
                <div className="error-msg" id="email-error">{emailError}</div>
              </div>

              <div className={`input-group full-width password-toggle-group ${passwordError ? 'invalid' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  required
                  placeholder=" "
                  autoComplete="current-password"
                  value={password}
                  onChange={handlePasswordChange}
                />
                <label htmlFor="password">Enter your password</label>
                <img
                  src={showPassword ? '/images/eye-regular-full.svg' : '/images/eye-slash-regular-full.svg'}
                  alt={showPassword ? 'Hide Password' : 'Show Password'}
                  className="password-toggle-icon"
                  id="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                />
                <div className="error-msg" id="password-error">{passwordError}</div>
              </div>

              <div className="form-actions">
                <Link to="/signup" className="btn-create-acc">Create account</Link>
                <button type="submit" className="btn-next" id="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying...' : 'Next'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
