import React, { useState, useRef } from 'react';
import AccountDropdown from './AccountDropdown';
import SettingsDropdown from './SettingsDropdown';
import SearchFilterPanel from './SearchFilterPanel';
import { getAvatarColor } from '../../utils/formatters';

export default function Header({
  user,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  onOpenHelp,
  onLogout,
  onDeleteAccount
}) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const avatarRef = useRef(null);
  const settingsRef = useRef(null);
  const filterToggleRef = useRef(null);

  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User';
  const initial = (user?.firstName ? user.firstName.charAt(0) : (user?.email ? user.email.charAt(0) : 'U')).toUpperCase();
  const avatarColor = getAvatarColor(user?.email || user?.firstName || 'user');

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <button
            type="button"
            className="icon-btn sidebar-toggle-btn"
            aria-label="Toggle Navigation menu"
            onClick={onToggleSidebar}
          >
            <img src="/images/three-horizontal-lined.svg" alt="Menu" className="sidebar-toggle-icon" />
          </button>
          <div className="logo-group">
            <img src="/images/inboxflow.svg" alt="InboxFlow Logo" className="logo-img" />
            <span className="logo-text">
              <span style={{ color: 'var(--logo-inbox, black)', fontWeight: 'bold' }}>Inbox</span>
              <span style={{ color: '#0b57d0', fontWeight: 'bold' }}>Flow</span>
            </span>
          </div>
        </div>

        <div className="header-center">
          <div className="search-bar">
            <img src="/images/magnifying-glass-solid-full.svg" alt="Search" className="search-bar-icon" />
            <input
              type="search"
              id="search-input"
              placeholder="Search mail"
              aria-label="Search mail"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  onSearchChange('');
                }
              }}
            />
            <button
              ref={filterToggleRef}
              type="button"
              className="filter-toggle"
              id="filter-toggle"
              aria-label="Advanced search"
              aria-expanded={isFilterOpen}
              title="Advanced search"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <img src="/images/sliders-solid-full.svg" alt="" className="filter-bar-icon" />
            </button>
          </div>

          <SearchFilterPanel
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onApplySearch={(query) => onSearchChange(query)}
            toggleButtonRef={filterToggleRef}
          />
        </div>

        <div className="header-right">
          <button
            type="button"
            className="icon-btn"
            id="inboxflow-help-button"
            aria-label="Help"
            onClick={onOpenHelp}
          >
            <img src="/images/question-svgrepo-com.svg" alt="Help" className="header-right-icon" />
          </button>
          <button
            ref={settingsRef}
            type="button"
            className="icon-btn"
            id="inboxflow-settings-button"
            aria-label="Settings"
            title="Settings"
            onClick={() => {
              setIsSettingsOpen(!isSettingsOpen);
              setIsAccountOpen(false);
            }}
          >
            <img src="/images/settings-gear-svgrepo-com.svg" alt="Settings" className="header-right-icon" />
          </button>
          <button
            ref={avatarRef}
            type="button"
            className="header-avatar-btn"
            id="header-avatar"
            title={`${displayName} (${user?.email})`}
            aria-label="Account Menu"
            style={{ backgroundColor: avatarColor, color: '#ffffff' }}
            onClick={() => {
              setIsAccountOpen(!isAccountOpen);
              setIsSettingsOpen(false);
            }}
          >
            {initial}
          </button>
        </div>
      </header>

      <SettingsDropdown
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        anchorRef={settingsRef}
        onDeleteAccount={onDeleteAccount}
      />

      <AccountDropdown
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        user={user}
        onLogout={onLogout}
        avatarRef={avatarRef}
      />
    </>
  );
}
