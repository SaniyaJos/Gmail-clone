import React, { useState } from 'react';
import EmailBody from './EmailBody';
import AttachmentCard from './AttachmentCard';
import { getAvatarColor, formatTimestamp, formatDetailedTimestamp } from '../../utils/formatters';

export default function ThreadMessageCard({
  email,
  userEmail,
  isDeleted = false,
  onToggleStar,
  onReply,
  onForward,
  onDelete,
  onRestore
}) {
  const [isCollapsed, setIsCollapsed] = useState(!isDeleted);

  const senderDisplayName =
    email.senderName || email.firstName || (email.sender || '').split('@')[0] || 'Unknown';
  const senderInitial = senderDisplayName.charAt(0).toUpperCase();
  const senderColor = getAvatarColor(email.sender || senderDisplayName);
  const shortTime = formatTimestamp(email.timestamp);
  const detailedTime = formatDetailedTimestamp(email.timestamp);

  const attachments = Array.isArray(email.attachments) ? email.attachments : [];

  if (isDeleted) {
    return (
      <div className="thread-message-card deleted-card" data-id={email._id}>
        <div className="thread-message-header">
          <div
            className="thread-sender-avatar"
            style={{ backgroundColor: senderColor, color: '#ffffff' }}
          >
            {senderInitial}
          </div>
          <div className="thread-sender-meta">
            <div className="thread-sender-row">
              <span className="thread-sender-name">{senderDisplayName}</span>
              <span className="thread-sender-email">&lt;{email.sender}&gt;</span>
              <span className="thread-folder-badge thread-bin-badge">Bin</span>
            </div>
            <div className="thread-receiver-row">
              <span>to {email.receiver}</span>
            </div>
          </div>
          <div className="thread-header-right">
            <span className="thread-time">{detailedTime}</span>
            <button
              type="button"
              className="deleted-msg-restore-btn"
              title="Restore this message"
              onClick={() => onRestore(email._id)}
            >
              Restore
            </button>
            <button
              type="button"
              className="deleted-msg-delete-btn"
              title="Delete forever"
              onClick={() => onDelete(email._id, true)}
            >
              Delete forever
            </button>
          </div>
        </div>

        <div className="thread-message-body">
          <EmailBody body={email.body} />
        </div>

        {attachments.length > 0 && (
          <div className="thread-message-attachments">
            <div className="email-attachments-list">
              {attachments.map((att) => (
                <AttachmentCard key={att._id} email={email} attachment={att} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`thread-message-card ${isCollapsed ? 'collapsed' : ''}`}
      data-id={email._id}
      onClick={() => setIsCollapsed(!isCollapsed)}
    >
      {isCollapsed ? (
        <div className="thread-message-collapsed-row">
          <div
            className="thread-collapsed-avatar"
            style={{ backgroundColor: senderColor, color: '#ffffff' }}
          >
            {senderInitial}
          </div>
          <span className="thread-collapsed-name">{senderDisplayName}</span>
          <span className="thread-collapsed-snippet">
            {(email.body || '').replace(/\s+/g, ' ').slice(0, 100)}
          </span>
          <span className="thread-collapsed-time">{shortTime}</span>
          <button
            type="button"
            className={`action-icon-btn thread-star-btn ${email.isStarred ? 'starred' : ''}`}
            title={email.isStarred ? 'Unstar message' : 'Star message'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(email);
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="thread-message-expanded" style={{ display: 'block' }}>
          <div className="thread-message-header">
            <div
              className="thread-sender-avatar"
              style={{ backgroundColor: senderColor, color: '#ffffff' }}
            >
              {senderInitial}
            </div>
            <div className="thread-sender-meta">
              <div className="thread-sender-row">
                <span className="thread-sender-name">{senderDisplayName}</span>
                <span className="thread-sender-email">&lt;{email.sender}&gt;</span>
              </div>
              <div className="thread-receiver-row">
                <span>to {email.receiver}</span>
              </div>
            </div>
            <div className="thread-header-right" onClick={(e) => e.stopPropagation()}>
              <span className="thread-time">{detailedTime}</span>
              <button
                type="button"
                className={`action-icon-btn thread-star-btn ${email.isStarred ? 'starred' : ''}`}
                title={email.isStarred ? 'Unstar message' : 'Star message'}
                onClick={() => onToggleStar(email)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </button>
              <button
                type="button"
                className="action-icon-btn thread-quick-reply-btn"
                title="Reply"
                onClick={() => onReply(email)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                </svg>
              </button>
              <button
                type="button"
                className="action-icon-btn thread-forward-btn"
                title="Forward"
                onClick={() => onForward(email)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                </svg>
              </button>
              <button
                type="button"
                className="action-icon-btn thread-delete-btn"
                title="Move to Bin"
                onClick={() => onDelete(email._id, false)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="thread-message-body">
            <EmailBody body={email.body} />
          </div>

          {attachments.length > 0 && (
            <div className="thread-message-attachments">
              <div className="email-attachments-list">
                {attachments.map((att) => (
                  <AttachmentCard key={att._id} email={email} attachment={att} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
