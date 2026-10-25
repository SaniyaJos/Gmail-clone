import React, { useState } from 'react';

export default function MailActionBar({
  activeFolder,
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onDeleteSelected,
  onRestoreSelected,
  onMarkReadSelected,
  onMarkUnreadSelected,
  onReportSpamSelected,
  onNotSpamSelected,
  onRefresh,
  customLabels,
  onApplyLabel,
  onRemoveLabel
}) {
  const [selectedLabelId, setSelectedLabelId] = useState('');

  const isBin = activeFolder === 'bin';
  const isSpam = activeFolder === 'spam';
  const hasSelection = selectedCount > 0;

  const countRangeText =
    totalCount === 0
      ? '0-0 of 0'
      : `1-${totalCount} of ${totalCount}`;

  return (
    <div className="mail-action-bar">
      <div className="action-left">
        <input
          type="checkbox"
          id="select-all"
          className="action-checkbox"
          aria-label="Select all mails"
          checked={allSelected && totalCount > 0}
          onChange={(e) => onToggleSelectAll(e.target.checked)}
          disabled={totalCount === 0}
        />

        {/* Delete button (Permanent delete in Bin/Spam, Move to Bin elsewhere) */}
        <button
          type="button"
          className="action-icon-btn"
          id="action-delete"
          title={isBin || isSpam ? 'Permanently delete' : 'Move to Bin'}
          disabled={!hasSelection}
          onClick={onDeleteSelected}
        >
          <img src="/images/trash-can-regular-full.svg" alt="Delete" className="action-bar-icon-img" />
        </button>

        {/* Restore button (in Bin only) */}
        {isBin && (
          <button
            type="button"
            className="action-icon-btn"
            id="action-restore"
            title="Restore selected messages"
            disabled={!hasSelection}
            onClick={onRestoreSelected}
          >
            <span className="restore-icon" aria-hidden="true">&#8630;</span>
          </button>
        )}

        {/* Unread & Read buttons */}
        {!isBin && !isSpam && (
          <>
            <button
              type="button"
              className="action-icon-btn"
              id="action-unread"
              title="Mark as unread"
              aria-label="Mark as unread"
              disabled={!hasSelection}
              onClick={onMarkUnreadSelected}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
              </svg>
            </button>
            <button
              type="button"
              className="action-icon-btn"
              id="action-read"
              title="Mark as read"
              aria-label="Mark as read"
              disabled={!hasSelection}
              onClick={onMarkReadSelected}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 3.32L19.99 8v.01L12 13 4 8.01V8l8-4.68zM4 18v-8.08l7.46 4.66c.16.1.35.15.54.15s.38-.05.54-.15L20 9.92V18H4z" />
              </svg>
            </button>
          </>
        )}

        {/* Report spam button (Inbox, Starred, All, Bin) */}
        {!isSpam && (
          <button
            type="button"
            className="action-icon-btn"
            id="action-spam"
            title="Report spam"
            disabled={!hasSelection}
            onClick={onReportSpamSelected}
          >
            <svg
              className="action-svg-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </button>
        )}

        {/* Not spam button (Spam only) */}
        {isSpam && (
          <button
            type="button"
            className="btn-text-action"
            id="action-not-spam"
            title="Move selected messages to Inbox"
            disabled={!hasSelection}
            onClick={onNotSpamSelected}
          >
            Not spam
          </button>
        )}

        {/* Refresh button */}
        <button
          type="button"
          className="action-icon-btn"
          id="action-refresh"
          title="Refresh"
          onClick={onRefresh}
        >
          <img src="/images/rotate-right-solid-full.svg" alt="Refresh" className="action-bar-icon-img" />
        </button>
      </div>

      <div className="action-right">
        <span className="mail-count-info" id="mail-count-range">
          {countRangeText}
        </span>
      </div>
    </div>
  );
}
