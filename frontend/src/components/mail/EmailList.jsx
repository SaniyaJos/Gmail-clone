import React from 'react';
import { formatTimestamp } from '../../utils/formatters';

const SPAM_ICON_SVG = (
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
);

export default function EmailList({
  emails,
  activeFolder,
  selectedIds,
  onToggleSelect,
  onToggleStar,
  onOpenEmail,
  onDeleteEmail,
  onRestoreEmail,
  onReportSpam,
  onNotSpam,
  onMarkRead,
  onMarkUnread,
  customLabels,
  userEmail
}) {
  const isBin = activeFolder === 'bin';
  const isSpam = activeFolder === 'spam';

  const canReportSpam = (email) => {
    return (
      Boolean(email) &&
      !email.isDraft &&
      !email.isSpam &&
      email.sender?.toLowerCase() !== userEmail?.toLowerCase() &&
      ['inbox', 'starred', 'all', 'bin'].includes(activeFolder)
    );
  };

  const canToggleRead = (email) => {
    return (
      Boolean(email) &&
      !email.isDraft &&
      !email.isTrash &&
      !email.isSpam &&
      ['inbox', 'starred', 'sent', 'all'].includes(activeFolder)
    );
  };

  return (
    <div className="mail-list-wrapper" id="mail-list-wrapper" style={{ display: 'block' }}>
      <ul className="email-list" id="email-list">
        {emails.map((email) => {
          const targetIds = email.threadEmailIds?.length > 0 ? email.threadEmailIds : [email._id];
          const isSelected = targetIds.every((id) => selectedIds.has(String(id)));
          const formattedDate = formatTimestamp(email.timestamp);

          return (
            <li
              key={email._id}
              className={`email-row ${email.isRead || email.isDraft ? 'read' : 'unread'}`}
              data-id={email._id}
              onClick={() => onOpenEmail(email)}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                className="email-row-select"
                data-id={email._id}
                aria-label="Select mail"
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onToggleSelect(targetIds, e.target.checked)}
              />

              {/* Star */}
              {!isBin && !isSpam && (
                <img
                  src="/images/star-regular-full.svg"
                  alt="Star"
                  role="button"
                  tabIndex={0}
                  aria-label={email.isStarred ? 'Unstar email' : 'Star email'}
                  className={`email-row-star ${email.isStarred ? 'starred' : ''}`}
                  data-id={email._id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(email);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleStar(email);
                    }
                  }}
                />
              )}

              {/* Sender */}
              <div className="email-sender">
                {email.isDraft ? (
                  <span className="draft-label">Draft</span>
                ) : (
                  <>
                    <span>{email.displaySenderText}</span>
                    {email.threadCount > 1 && (
                      <span className="email-thread-count">{email.threadCount}</span>
                    )}
                  </>
                )}
              </div>

              {/* Subject & Snippet & Labels */}
              <div className="email-content">
                <span className="email-subject">{email.displaySubject || email.subject}</span>
                <span className="email-snippet">— {email.displaySnippet}</span>
                <span className="email-row-labels">
                  {customLabels
                    .filter((lbl) => (email.labels || []).some((id) => String(id) === lbl._id))
                    .map((lbl) => (
                      <span key={lbl._id} className="custom-label-chip">
                        {lbl.name}
                      </span>
                    ))}
                </span>
                {email.daysLeft !== undefined && (
                  <span className={`email-expiry ${email.daysLeft <= 3 ? 'soon' : ''}`}>
                    {email.daysLeft} day{email.daysLeft !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>

              {/* Date */}
              <div className="email-date">{formattedDate}</div>

              {/* Hover Actions */}
              <div className="email-row-actions" onClick={(e) => e.stopPropagation()}>
                {isBin ? (
                  <>
                    {canReportSpam(email) && (
                      <button
                        type="button"
                        className="action-icon-btn btn-row-spam"
                        title="Report spam"
                        onClick={() => onReportSpam(email._id)}
                      >
                        {SPAM_ICON_SVG}
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-icon-btn btn-row-restore"
                      title="Restore"
                      onClick={() => onRestoreEmail(email._id)}
                    >
                      <span className="restore-icon" aria-hidden="true">&#8630;</span>
                    </button>
                    <button
                      type="button"
                      className="action-icon-btn btn-row-delete"
                      title="Permanently delete"
                      onClick={() => onDeleteEmail(targetIds, true)}
                    >
                      <img src="/images/trash-can-regular-full.svg" alt="Delete" className="row-action-icon-img" />
                    </button>
                  </>
                ) : isSpam ? (
                  <>
                    <button
                      type="button"
                      className="btn-text-action btn-row-notspam"
                      title="Not spam"
                      onClick={() => onNotSpam(email._id)}
                    >
                      Not spam
                    </button>
                    <button
                      type="button"
                      className="action-icon-btn btn-row-delete"
                      title="Delete forever"
                      onClick={() => onDeleteEmail(targetIds, true)}
                    >
                      <img src="/images/trash-can-regular-full.svg" alt="Delete" className="row-action-icon-img" />
                    </button>
                  </>
                ) : (
                  <>
                    {canToggleRead(email) && (
                      email.isRead ? (
                        <button
                          type="button"
                          className="action-icon-btn btn-row-unread"
                          title="Mark as unread"
                          aria-label="Mark as unread"
                          onClick={() => onMarkUnread(targetIds)}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="action-icon-btn btn-row-read"
                          title="Mark as read"
                          aria-label="Mark as read"
                          onClick={() => onMarkRead(targetIds)}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 3.32L19.99 8v.01L12 13 4 8.01V8l8-4.68zM4 18v-8.08l7.46 4.66c.16.1.35.15.54.15s.38-.05.54-.15L20 9.92V18H4z" />
                          </svg>
                        </button>
                      )
                    )}
                    {canReportSpam(email) && (
                      <button
                        type="button"
                        className="action-icon-btn btn-row-spam"
                        title="Report spam"
                        onClick={() => onReportSpam(email._id)}
                      >
                        {SPAM_ICON_SVG}
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-icon-btn btn-row-delete"
                      title="Move to Bin"
                      onClick={() => onDeleteEmail(targetIds, false)}
                    >
                      <img src="/images/trash-can-regular-full.svg" alt="Move to Bin" className="row-action-icon-img" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
