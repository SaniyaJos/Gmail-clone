import React, { useEffect, useRef } from 'react';
import ThemeToggle from '../common/ThemeToggle';
import { getAvatarColor } from '../../utils/formatters';

export default function AccountDropdown({
  isOpen,
  onClose,
  user,
  onLogout,
  avatarRef
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        (!avatarRef.current || !avatarRef.current.contains(event.target))
      ) {
        onClose();
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose, avatarRef]);

  if (!isOpen) return null;

  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User';
  const initial = (user?.firstName ? user.firstName.charAt(0) : (user?.email ? user.email.charAt(0) : 'U')).toUpperCase();
  const avatarColor = getAvatarColor(user?.email || user?.firstName || 'user');

  return (
    <div
      ref={dropdownRef}
      className="account-dropdown"
      id="account-dropdown"
      style={{ display: 'flex' }}
    >
      <div
        className="dropdown-avatar"
        id="dropdown-avatar"
        style={{ backgroundColor: avatarColor, color: '#ffffff' }}
      >
        {initial}
      </div>
      <div className="dropdown-name" id="dropdown-name">{displayName}</div>
      <div className="dropdown-email" id="dropdown-email">{user?.email}</div>
      <div className="dropdown-divider"></div>
      <ThemeToggle className="account-theme-toggle" />
      <button
        type="button"
        className="btn-dropdown-logout"
        id="btn-dropdown-logout"
        onClick={onLogout}
      >
        Sign out
      </button>
    </div>
  );
}
