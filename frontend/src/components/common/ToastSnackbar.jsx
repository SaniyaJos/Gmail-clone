import React from 'react';

export default function ToastSnackbar({ toast, onClose }) {
  if (!toast || !toast.visible) return null;

  return (
    <div
      id="toast-snackbar"
      className="toast-snackbar"
      style={{ display: 'flex' }}
      role="status"
      aria-live="polite"
    >
      <span className="toast-message" id="toast-message">
        {toast.message}
      </span>
      {toast.onAction && (
        <button
          type="button"
          className="toast-action-btn"
          id="toast-action-btn"
          onClick={() => {
            const action = toast.onAction;
            onClose();
            if (typeof action === 'function') action();
          }}
        >
          {toast.actionText || 'Undo'}
        </button>
      )}
      <button
        type="button"
        className="toast-close-btn"
        id="toast-close-btn"
        aria-label="Close notification"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
