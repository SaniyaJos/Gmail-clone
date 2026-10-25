import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'inboxflow-theme';
const USER_KEY_PREFIX = `${THEME_KEY}:`;
const VALID_THEMES = new Set(['light', 'dark']);

function getUserEmail() {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

function getPreferenceKey(email = getUserEmail()) {
  return email ? `${USER_KEY_PREFIX}${email}` : THEME_KEY;
}

function readTheme(key) {
  try {
    const value = localStorage.getItem(key);
    return VALID_THEMES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function getInitialTheme() {
  const email = getUserEmail();
  const accountTheme = email ? readTheme(getPreferenceKey(email)) : null;
  const savedTheme = readTheme(THEME_KEY);
  return accountTheme || savedTheme || 'light';
}

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  const applyTheme = useCallback((nextTheme, persist = true, email = getUserEmail()) => {
    if (!VALID_THEMES.has(nextTheme)) return;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;

    if (persist) {
      try {
        const key = email ? `${USER_KEY_PREFIX}${email}` : THEME_KEY;
        localStorage.setItem(key, nextTheme);
        if (email) localStorage.removeItem(THEME_KEY);
      } catch (err) {
        console.warn('Could not save theme preference.', err);
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, applyTheme]);

  const applyThemeForUser = useCallback((userEmail) => {
    const normalized = typeof userEmail === 'string' ? userEmail.trim().toLowerCase() : '';
    if (!normalized) return;
    const userTheme = readTheme(`${USER_KEY_PREFIX}${normalized}`);
    applyTheme(userTheme || theme, true, normalized);
  }, [theme, applyTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, applyTheme, applyThemeForUser }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
