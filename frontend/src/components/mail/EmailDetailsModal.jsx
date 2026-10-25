import React, { useState } from 'react';
import EmailBody from './EmailBody';
import AttachmentCard from './AttachmentCard';
import ThreadMessageCard from './ThreadMessageCard';
import InlineTaskSection from '../tasks/InlineTaskSection';
import { getAvatarColor, formatDetailedTimestamp } from '../../utils/formatters';

export default function EmailDetailsModal({
  isOpen,
  email,
  threadEmails,
  activeFolder,
  userEmail,
  customLabels,
  emailTasks,
  isExtracting,
  onClose,
  onExtractActions,
  onToggleStar,
  onDeleteEmail,
  onRestoreEmail,
  onReportSpam,
  onNotSpam,
  onMarkUnread,
  onApplyLabel,
  onRemoveLabel,
  onReply,
  onReplyAll,
  onForward,
  onToggleTaskStatus,
  onDeleteTask
}) {
  const [showEmailInfo, setShowEmailInfo] = useState(false);
  const [showDeletedMessages, setShowDeletedMessages] = useState(false);

  if (!isOpen || !email) return null;

  const inBin = activeFolder === 'bin' || Boolean(email.isTrash);
  const inSpam = activeFolder === 'spam' || Boolean(email.isSpam);
  const isDraft = Boolean(email.isDraft);

  // Group thread messages into active and deleted
  const allThread = threadEmails && threadEmails.length > 0 ? threadEmails : [email];
  const activeThread = inBin ? allThread.filter((e) => e.isTrash) : allThread.filter((e) => !e.isTrash);
  const deletedThread = inBin ? [] : allThread.filter((e) => e.isTrash);

  const latestMessage = activeThread[activeThread.length - 1] || email;
  const olderMessages = activeThread.slice(0, activeThread.length - 1);

  const senderDisplayName =
    latestMessage.senderName || latestMessage.firstName || (latestMessage.sender || '').split('@')[0] || 'Unknown';
  const senderInitial = senderDisplayName.charAt(0).toUpperCase();
  const senderColor = getAvatarColor(latestMessage.sender || senderDisplayName);
  const detailedTime = formatDetailedTimestamp(latestMessage.timestamp);

  const canReplyOrForward = !inBin && !inSpam && !isDraft;
  const canReportSpam = !inSpam && !isDraft && latestMessage.sender?.toLowerCase() !== userEmail?.toLowerCase();

  // Clean subject
  const origSubject = latestMessage.subject === '(No Subject)' ? '' : (latestMessage.subject || '');
  const cleanSubject = origSubject.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim() || origSubject || '(No Subject)';

  // Determine if Reply all is available
  const participants = new Set();
  if (latestMessage.sender && latestMessage.sender.toLowerCase() !== userEmail.toLowerCase()) {
    participants.add(latestMessage.sender.toLowerCase());
  }
  if (latestMessage.receiver) {
    latestMessage.receiver.split(',').forEach((r) => {
      const clean = r.trim().toLowerCase();
      if (clean && clean !== userEmail.toLowerCase()) participants.add(clean);
    });
  }
  const showReplyAll = canReplyOrForward && participants.size > 1;

  // Spam reasons: match spamService.js friendly messages (no raw technical model details or confidence percentages)
  const rawSpamReasons = Array.isArray(latestMessage.spamReasons) && latestMessage.spamReasons.length > 0
    ? latestMessage.spamReasons
    : ['It is similar to messages that were identified as spam.'];

  const spamReasons = [...new Set(
    rawSpamReasons.map((r) => {
      if (typeof r !== 'string') return 'It is similar to messages that were identified as spam.';
      if (/reported|blocked|preference/i.test(r)) {
        return 'You previously reported messages from this sender as spam.';
      }
      return 'It is similar to messages that were identified as spam.';
    })
  )];

  const attachments = Array.isArray(latestMessage.attachments) ? latestMessage.attachments : [];
  const assignedLabelIds = new Set([
    ...(latestMessage?.labels || []).map(String),
    ...(email?.labels || []).map(String)
  ]);

  return (
    <div className="email-details-modal" id="email-details-modal" style={{ display: 'flex' }}>
      {/* Details Header Toolbar */}
      <div className="details-header">
        <button
          type="button"
          className="icon-btn back-btn"
          id="btn-details-back"
          title="Back"
          onClick={onClose}
        >
          <span style={{ fontSize: '20px', lineHeight: 1 }}>&larr;</span>
        </button>

        <div className="details-actions">
          {/* Extract Actions Gemini AI Button */}
          {!inBin && !inSpam && !isDraft && (
            <button
              type="button"
              className="btn-action-extract"
              id="btn-extract-actions"
              title="Extract actionable tasks using AI"
              disabled={isExtracting}
              onClick={() => onExtractActions(latestMessage._id, false)}
            >
              <svg className="gemini-sparkle-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
              </svg>
              <span className="btn-extract-text" id="btn-extract-text">
                {isExtracting ? 'Analyzing...' : 'Extract Actions'}
              </span>
              {isExtracting && (
                <span className="extract-spinner" id="btn-extract-spinner" style={{ display: 'inline-block' }} />
              )}
            </button>
          )}

          {!inBin && !inSpam && !isDraft && (
            <button
              type="button"
              className="action-icon-btn"
              id="details-action-unread"
              title="Mark as unread"
              aria-label="Mark as unread"
              onClick={() => {
                onClose();
                onMarkUnread([latestMessage._id]);
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
              </svg>
            </button>
          )}

          {canReportSpam && (
            <button
              type="button"
              className="action-icon-btn"
              id="details-action-spam"
              title="Report spam"
              onClick={() => {
                onClose();
                onReportSpam(latestMessage._id);
              }}
            >
              <svg
                className="action-svg-icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
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

          {inSpam && (
            <button
              type="button"
              className="btn-text-action"
              id="details-action-not-spam"
              title="Move to Inbox"
              onClick={() => {
                onClose();
                onNotSpam(latestMessage._id);
              }}
            >
              Not spam
            </button>
          )}

          {inBin && (
            <button
              type="button"
              className="action-icon-btn"
              id="details-action-restore"
              title="Restore"
              onClick={() => {
                onClose();
                onRestoreEmail(latestMessage._id);
              }}
            >
              <span className="restore-icon" aria-hidden="true">&#8630;</span>
            </button>
          )}

          <button
            type="button"
            className="action-icon-btn"
            id="details-action-delete"
            title={inBin || inSpam ? 'Permanently delete' : 'Move to Bin'}
            onClick={() => {
              onClose();
              onDeleteEmail([latestMessage._id], inBin || inSpam);
            }}
          >
            <img src="/images/trash-can-regular-full.svg" alt="Delete" className="details-delete-icon" style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </div>

      {/* Details Body */}
      <div className="details-body">
        {/* Spam warning - only shown if email is in Spam and has actual reasons from spamService */}
        {inSpam && spamReasons.length > 0 && (
          <div className="spam-warning" id="spam-warning" style={{ display: 'block' }}>
            <div className="spam-warning-title">Why is this message in Spam?</div>
            <div className="spam-warning-reasons" id="spam-warning-reasons">
              {spamReasons.join(' • ')}
            </div>
          </div>
        )}

        {/* Subject row */}
        <div className="details-subject-row">
          <h2 className="details-subject" id="details-subject">{cleanSubject}</h2>
          {!inBin && !inSpam && (
            <button
              type="button"
              className="details-star-button"
              id="details-star-button"
              aria-label={latestMessage.isStarred ? 'Unstar email' : 'Star email'}
              aria-pressed={latestMessage.isStarred}
              title={latestMessage.isStarred ? 'Unstar email' : 'Star email'}
              onClick={() => onToggleStar(latestMessage)}
            >
              <img
                src="/images/star-regular-full.svg"
                alt=""
                className={`details-star-icon ${latestMessage.isStarred ? 'starred' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Labels panel */}
        <section className="email-labels-panel" id="email-labels-panel" aria-label="Email labels">
          <div className="email-label-chips" id="email-label-chips">
            {customLabels
              .filter((lbl) => assignedLabelIds.has(String(lbl._id)))
              .map((lbl) => (
                <span key={lbl._id} className="custom-label-chip">{lbl.name}</span>
              ))}
          </div>
        </section>

        {/* Deleted Messages Banner */}
        {deletedThread.length > 0 && (
          <div className="thread-deleted-banner" id="thread-deleted-banner" style={{ display: 'flex' }}>
            <span className="thread-deleted-text" id="thread-deleted-text">
              {deletedThread.length} deleted message{deletedThread.length > 1 ? 's' : ''} in this conversation.
            </span>
            <div className="thread-deleted-actions">
              <button
                type="button"
                className="thread-deleted-link"
                id="btn-view-deleted-msg"
                onClick={() => setShowDeletedMessages(!showDeletedMessages)}
              >
                {showDeletedMessages
                  ? (deletedThread.length > 1 ? 'Hide messages' : 'Hide message')
                  : (deletedThread.length > 1 ? 'View messages' : 'View message')}
              </button>
              <span className="thread-deleted-sep">or</span>
              <span className="thread-deleted-forever-wrap">
                <button
                  type="button"
                  className="thread-deleted-link"
                  id="btn-delete-forever-msg"
                  onClick={() => {
                    if (confirm('Permanently delete all deleted messages in this conversation?')) {
                      deletedThread.forEach((msg) => onDeleteEmail([msg._id], true));
                    }
                  }}
                >
                  delete forever
                </button>
                .
              </span>
            </div>
          </div>
        )}

        {/* Deleted messages list */}
        {showDeletedMessages && deletedThread.length > 0 && (
          <div className="thread-deleted-messages" id="thread-deleted-messages" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {deletedThread.map((msg) => (
              <ThreadMessageCard
                key={msg._id}
                email={msg}
                userEmail={userEmail}
                isDeleted={true}
                onRestore={onRestoreEmail}
                onDelete={(id, perm) => onDeleteEmail([id], perm)}
              />
            ))}
          </div>
        )}

        {/* Older Messages in Conversation */}
        {olderMessages.length > 0 && (
          <div className="thread-older-messages" id="thread-older-messages" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {olderMessages.map((msg) => (
              <ThreadMessageCard
                key={msg._id}
                email={msg}
                userEmail={userEmail}
                onToggleStar={onToggleStar}
                onReply={onReply}
                onForward={onForward}
                onDelete={(id, perm) => onDeleteEmail([id], perm)}
              />
            ))}
          </div>
        )}

        {/* Latest message header & info */}
        <div className={`details-sender-info ${olderMessages.length > 0 || deletedThread.length > 0 ? 'has-previous-messages' : ''}`} id="details-sender-info">
          <div
            className="sender-avatar"
            id="details-sender-avatar"
            style={{ backgroundColor: senderColor, color: '#ffffff' }}
          >
            {senderInitial}
          </div>
          <div className="sender-metadata">
            <div className="sender-identity">
              <span className="sender-name" id="details-sender-name">{senderDisplayName}</span>
              <span className="sender-email" id="details-sender-email">&lt;{latestMessage.sender}&gt;</span>
            </div>
            <div className="receiver-row">
              <span className="receiver-email" id="details-receiver-email">to {latestMessage.receiver}</span>
              <button
                type="button"
                className="email-info-toggle"
                id="email-info-toggle"
                aria-expanded={showEmailInfo}
                aria-controls="email-info-panel"
                title="Show message details"
                onClick={() => setShowEmailInfo(!showEmailInfo)}
              >
                <span aria-hidden="true">▾</span>
              </button>
            </div>
          </div>

          <div className="details-sender-right">
            <span className="details-time" id="details-timestamp">{detailedTime}</span>

            {/* Label picker dropdown */}
            <details className="email-label-picker" id="email-label-picker">
              <summary aria-label="Manage labels" title="Manage labels">
                <img src="/images/label-outline.svg" alt="" />
              </summary>
              <div className="email-label-options" id="email-label-options">
                {customLabels.length === 0 ? (
                  <span className="label-feedback">Create a label in the sidebar first.</span>
                ) : (
                  customLabels.map((lbl) => (
                    <label key={lbl._id} className="email-label-option">
                      <input
                        type="checkbox"
                        checked={assignedLabelIds.has(String(lbl._id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onApplyLabel(lbl._id, [latestMessage._id]);
                          } else {
                            onRemoveLabel(lbl._id, [latestMessage._id]);
                          }
                        }}
                      />
                      <span>{lbl.name}</span>
                    </label>
                  ))
                )}
              </div>
            </details>

            {/* Header star */}
            {!inBin && !inSpam && (
              <button
                type="button"
                className={`action-icon-btn details-header-star-btn ${latestMessage.isStarred ? 'starred' : ''}`}
                id="btn-header-star"
                title={latestMessage.isStarred ? 'Unstar email' : 'Star email'}
                onClick={() => onToggleStar(latestMessage)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </button>
            )}

            {canReplyOrForward && (
              <>
                <button
                  type="button"
                  className="action-icon-btn details-header-reply-btn"
                  id="btn-header-reply"
                  title="Reply"
                  onClick={() => onReply(latestMessage)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="action-icon-btn details-header-forward-btn"
                  id="btn-header-forward"
                  title="Forward"
                  onClick={() => onForward(latestMessage)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                  </svg>
                </button>
              </>
            )}

            <button
              type="button"
              className="action-icon-btn details-header-delete-btn"
              id="btn-header-delete"
              title={inBin || inSpam ? 'Permanently delete' : 'Move to Bin'}
              onClick={() => {
                onClose();
                onDeleteEmail([latestMessage._id], inBin || inSpam);
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Extended Email Details info panel */}
        {showEmailInfo && (
          <section className="email-info-panel" id="email-info-panel" aria-label="Message details">
            <dl>
              <div><dt>From</dt><dd id="email-info-from">{latestMessage.sender}</dd></div>
              <div><dt>To</dt><dd id="email-info-to">{latestMessage.receiver}</dd></div>
              <div><dt>Date</dt><dd id="email-info-date">{detailedTime}</dd></div>
              <div><dt>Subject</dt><dd id="email-info-subject">{latestMessage.subject}</dd></div>
              <div><dt>Security</dt><dd id="email-info-security">No transport-security or authentication details are recorded for this message.</dd></div>
            </dl>
          </section>
        )}

        {/* Message body */}
        <EmailBody body={latestMessage.body} />

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <section className="email-attachments" id="email-attachments" aria-label="Email attachments">
            <h3>Attachments</h3>
            <div className="email-attachments-list" id="email-attachments-list">
              {attachments.map((att) => (
                <AttachmentCard key={att._id} email={latestMessage} attachment={att} />
              ))}
            </div>
          </section>
        )}

        {/* Inline AI Extracted Tasks */}
        <InlineTaskSection
          tasks={emailTasks}
          onReExtract={() => onExtractActions(latestMessage._id, true)}
          onToggleTaskStatus={onToggleTaskStatus}
          onDeleteTask={onDeleteTask}
        />

        {/* Bottom Reply / Reply all / Forward bar */}
        {canReplyOrForward && (
          <div className="details-reply-forward-bar" id="details-reply-forward-bar" style={{ display: 'flex' }}>
            <button
              type="button"
              className="btn-detail-action"
              id="btn-detail-reply"
              title="Reply"
              onClick={() => onReply(latestMessage)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
              </svg>
              <span>Reply</span>
            </button>
            {showReplyAll && (
              <button
                type="button"
                className="btn-detail-action"
                id="btn-detail-reply-all"
                title="Reply all"
                onClick={() => onReplyAll(latestMessage)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M7 8V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                  <path d="M13 9V6.5L9.5 10l3.5 3.5V11c3.5 0 6 1.1 7.8 3.5-.7-3.5-2.8-7-7.8-7.7z" />
                </svg>
                <span>Reply all</span>
              </button>
            )}
            <button
              type="button"
              className="btn-detail-action"
              id="btn-detail-forward"
              title="Forward"
              onClick={() => onForward(latestMessage)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
              </svg>
              <span>Forward</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
