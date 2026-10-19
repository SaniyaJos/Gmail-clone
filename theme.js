(() => {
  const THEME_KEY = 'inboxflow-theme';
  const USER_KEY_PREFIX = `${THEME_KEY}:`;
  const validThemes = new Set(['light', 'dark']);

  function getUserEmail() {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
      return typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
    } catch (error) {
      console.warn('Could not read the signed-in user for theme preferences.', error);
      return '';
    }
  }

  function getPreferenceKey(email = getUserEmail()) {
    return email ? `${USER_KEY_PREFIX}${email}` : THEME_KEY;
  }

  function readTheme(key) {
    try {
      const value = localStorage.getItem(key);
      return validThemes.has(value) ? value : null;
    } catch (error) {
      console.warn('Could not read the saved theme preference.', error);
      return null;
    }
  }

  const startupEmail = getUserEmail();
  const accountTheme = startupEmail ? readTheme(getPreferenceKey(startupEmail)) : null;
  const savedTheme = readTheme(THEME_KEY);
  let theme = accountTheme || savedTheme || 'light';
  if (startupEmail && !accountTheme && savedTheme) {
    try {
      localStorage.setItem(getPreferenceKey(startupEmail), savedTheme);
      localStorage.removeItem(THEME_KEY);
    } catch (error) {
      console.warn('Could not move the theme preference to the signed-in account.', error);
    }
  }
  document.documentElement.dataset.theme = theme;

  function applyTheme(nextTheme, persist = true, email = getUserEmail()) {
    if (!validThemes.has(nextTheme)) return;
    theme = nextTheme;
    document.documentElement.dataset.theme = theme;

    if (persist) {
      try {
        localStorage.setItem(email ? `${USER_KEY_PREFIX}${email}` : THEME_KEY, theme);
        if (email) localStorage.removeItem(THEME_KEY);
      } catch (error) {
        console.warn('Could not save the theme preference.', error);
      }
    }

    document.querySelectorAll('.theme-toggle').forEach(button => {
      const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      const label = button.querySelector('.theme-toggle-label');
      if (label) label.textContent = theme === 'dark' ? 'Dark mode' : 'Light mode';
      const icon = button.querySelector('.theme-toggle-icon');
      if (icon) {
        icon.innerHTML = theme === 'dark'
          ? '<path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z"/>'
          : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>';
      }
    });
  }

  window.applyInboxFlowThemeForUser = email => {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) return;
    const userTheme = readTheme(`${USER_KEY_PREFIX}${normalizedEmail}`);
    applyTheme(userTheme || theme, true, normalizedEmail);
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.addEventListener('click', () => {
        applyTheme(theme === 'dark' ? 'light' : 'dark');
      });
    });
    applyTheme(theme, false);
  });
})();
