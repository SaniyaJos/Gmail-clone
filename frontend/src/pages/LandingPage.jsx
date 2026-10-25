import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import '../styles/style.css';

export default function LandingPage() {
  return (
    <div className="landing-page-container">
      <header className="header">
        <div className="header-container">
          <div className="logo-group">
            <img src="/images/inboxflow.svg" alt="InboxFlow Logo" className="gmail-logo" />
            <span className="logo-text">
              <span style={{ color: 'var(--logo-inbox, black)', fontWeight: 'bold' }}>Inbox</span>
              <span style={{ color: '#0b57d0', fontWeight: 'bold' }}>Flow</span>
            </span>
          </div>
          <div className="auth-group">
            <ThemeToggle />
            <Link to="/signin" className="btn btn-secondary" id="btn-signin-nav">Sign in</Link>
            <Link to="/signup" className="btn btn-primary" id="btn-create-nav">Create an account</Link>
          </div>
        </div>
      </header>

      <main className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Secure, smart,<br />and easy-to-use email</h1>
            <p className="hero-desc">
              Send, receive, organize, and manage your emails with a clean and intuitive mail experience designed for
              everyday communication.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-large" id="btn-create-hero">
                Create an account
              </Link>
            </div>
          </div>
          <div className="hero-image-wrapper">
            <img src="/images/home.png" alt="InboxFlow Inbox Interface Preview" className="hero-image" />
          </div>
        </div>
      </main>
    </div>
  );
}
