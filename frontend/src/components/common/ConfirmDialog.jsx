import React, { useEffect } from 'react';

export default function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmText = 'OK',
  cancelText = 'Cancel',
  secondaryText = null,
  onSecondary = null,
  isDanger = false,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirm-dialog-card">
        <div className="confirm-dialog-title">{title}</div>
        <div className="confirm-dialog-body">{body}</div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-dialog-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          {secondaryText && onSecondary && (
            <button type="button" className="btn-dialog-secondary" onClick={onSecondary}>
              {secondaryText}
            </button>
          )}
          <button
            type="button"
            className={`btn-dialog-confirm ${isDanger ? 'btn-dialog-danger' : ''}`.trim()}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
