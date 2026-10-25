import React, { useEffect, useRef } from 'react';
import ThemeToggle from '../common/ThemeToggle';

export default function SettingsDropdown({
  isOpen,
  onClose,
  anchorRef,
  onDeleteAccount
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        (!anchorRef.current || !anchorRef.current.contains(event.target))
      ) {
        onClose();
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="settings-dropdown"
      id="settings-dropdown"
      role="menu"
      aria-label="Quick Settings"
    >
      <div className="settings-dropdown-header">
        <h3 className="settings-dropdown-title">Quick Settings</h3>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Appearance</div>
        <div className="settings-theme-row">
          <ThemeToggle className="settings-theme-toggle" />
        </div>
      </div>

      <div className="dropdown-divider"></div>

      <div className="settings-section">
        <div className="settings-section-label danger-label">Account Management</div>
        <button
          type="button"
          className="btn-settings-delete-account"
          id="btn-settings-delete-account"
          onClick={() => {
            onClose();
            onDeleteAccount();
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          <span>Delete Account</span>
        </button>
        <p className="settings-delete-hint">
          Permanently deletes your account, personal data, and all inbox emails from the InboxFlow
        </p>
      </div>
    </div>
  );
}
