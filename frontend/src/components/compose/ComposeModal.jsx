import React, { useState, useEffect, useRef } from 'react';
import { authApi, emailApi } from '../../services/api';
import { formatFileSize } from '../../utils/formatters';

const ALLOWED_ATTACHMENT_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_DRAFT_ATTACHMENTS = 10;

export default function ComposeModal({
  isOpen,
  initialData,
  userEmail,
  onClose,
  onSendSuccess,
  onDiscard
}) {
  const [modalState, setModalState] = useState('normal'); // 'normal', 'minimized', 'maximized'
  const [recipients, setRecipients] = useState([]);
  const [toInput, setToInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSubjectConfirm, setShowSubjectConfirm] = useState(false);

  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setRecipients(initialData.recipients || []);
        setSubject(initialData.subject || '');
        setBody(initialData.body || '');
        setAttachments(initialData.attachments || []);
        setDraftId(initialData.draftId || null);
      } else {
        setRecipients([]);
        setSubject('');
        setBody('');
        setAttachments([]);
        setDraftId(null);
      }
      setToInput('');
      setModalState('normal');
      setIsUploading(false);
      setIsSending(false);
      setShowSubjectConfirm(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const title = initialData?.title || (draftId ? 'Edit Message' : 'New Message');

  const addRecipient = async (val) => {
    let email = val.trim().toLowerCase();
    if (!email) return;

    if (!email.includes('@')) {
      email = `${email}@flow.com`;
    }

    if (recipients.includes(email)) {
      setToInput('');
      return;
    }

    try {
      const data = await authApi.checkUsername(email);
      if (data.exists) {
        setRecipients((prev) => [...prev, email]);
        setToInput('');
      } else {
        alert('User Not Found');
      }
    } catch (err) {
      console.error('Error checking user availability:', err);
      alert('Error verifying recipient.');
    }
  };

  const handleToKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await addRecipient(toInput);
    }
  };

  const removeRecipient = (index) => {
    setRecipients((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Auto-save draft on close
  const saveDraftOnExit = async () => {
    if (isUploading) return;
    const finalRecipients = [...recipients];
    if (toInput.trim()) {
      let email = toInput.trim().toLowerCase();
      if (!email.includes('@')) email = `${email}@flow.com`;
      if (!finalRecipients.includes(email)) finalRecipients.push(email);
    }

    const isEmpty =
      finalRecipients.length === 0 && !subject.trim() && !body.trim() && attachments.length === 0;

    try {
      if (isEmpty) {
        if (draftId) {
          await emailApi.deleteEmail(draftId);
        }
      } else {
        const payload = {
          sender: userEmail,
          receiver: finalRecipients.join(', '),
          subject: subject.trim(),
          body,
          attachments,
          isDraft: true
        };
        if (draftId) {
          await emailApi.updateDraft(draftId, payload);
        } else {
          await emailApi.createEmail(payload);
        }
      }
    } catch (err) {
      console.error('Auto-save draft error:', err);
    }
  };

  const handleClose = async () => {
    await saveDraftOnExit();
    onClose();
  };

  const handleDiscard = async () => {
    if (draftId) {
      try {
        await emailApi.deleteEmail(draftId);
      } catch (err) {
        console.error('Error deleting draft:', err);
      }
    }
    onDiscard();
  };

  const ensureDraftForAttachments = async () => {
    if (draftId) return draftId;
    const res = await emailApi.createEmail({
      sender: userEmail,
      receiver: recipients.join(', '),
      subject: subject.trim(),
      body,
      attachments,
      isDraft: true
    });
    const id = res.email._id;
    setDraftId(id);
    return id;
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const accepted = [];
    const rejected = [];
    const seenKeys = new Set(
      attachments.map((att) => `${att.filename.toLowerCase()}|${att.size}|${att.mimeType}`)
    );

    files.forEach((file) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const validExts = ALLOWED_ATTACHMENT_TYPES[file.type];
      if (!validExts || !validExts.includes(ext)) {
        rejected.push(`${file.name}: unsupported file type`);
      } else if (file.size > MAX_ATTACHMENT_SIZE) {
        rejected.push(`${file.name}: larger than 10 MB`);
      } else {
        const key = `${file.name.toLowerCase()}|${file.size}|${file.type}`;
        if (seenKeys.has(key)) {
          rejected.push(`${file.name}: duplicate attachment`);
        } else {
          seenKeys.add(key);
          accepted.push(file);
        }
      }
    });

    const slots = MAX_DRAFT_ATTACHMENTS - attachments.length;
    if (accepted.length > slots) {
      rejected.push(`Only ${slots} attachment slot(s) remain (maximum ${MAX_DRAFT_ATTACHMENTS}).`);
      accepted.splice(Math.max(0, slots));
    }

    if (rejected.length > 0) {
      alert(`Some files were not added:\n${rejected.join('\n')}`);
    }

    if (accepted.length === 0) return;

    setIsUploading(true);
    try {
      const currentId = await ensureDraftForAttachments();
      const res = await emailApi.uploadAttachments(currentId, accepted);
      setAttachments(res.attachments || []);
    } catch (err) {
      console.error('Attachment upload failed:', err);
      alert(err.message || 'Attachment upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async (att) => {
    if (!draftId) {
      setAttachments((prev) => prev.filter((a) => a !== att));
      return;
    }
    try {
      const res = await emailApi.deleteAttachment(draftId, att._id);
      setAttachments(res.attachments || []);
    } catch (err) {
      console.error('Remove attachment error:', err);
      setAttachments((prev) => prev.filter((a) => a._id !== att._id));
    }
  };

  const executeSend = async (finalSubject) => {
    const allRecips = [...recipients];
    if (toInput.trim()) {
      let email = toInput.trim().toLowerCase();
      if (!email.includes('@')) email = `${email}@flow.com`;
      if (!allRecips.includes(email)) allRecips.push(email);
    }

    if (allRecips.length === 0) {
      alert('Please enter at least one verified recipient.');
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        sender: userEmail,
        receiver: allRecips.join(', '),
        subject: finalSubject || '(No Subject)',
        body,
        attachments,
        ...(draftId ? { draftId } : {}),
        ...(initialData?.threadId ? { threadId: initialData.threadId } : {}),
        ...(initialData?.inReplyTo ? { inReplyTo: initialData.inReplyTo } : {})
      };

      const res = await emailApi.createEmail(payload);
      if (draftId) {
        try {
          await emailApi.deleteEmail(draftId);
        } catch (_) {}
      }

      onSendSuccess({
        sentEmail: res.email,
        undoContext: {
          recipients: allRecips,
          subject: finalSubject,
          body,
          attachments,
          threadId: initialData?.threadId,
          inReplyTo: initialData?.inReplyTo
        }
      });
    } catch (err) {
      console.error('Send failed:', err);
      alert(err.message || 'Could not send email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendClick = () => {
    let finalRecips = [...recipients];
    if (toInput.trim()) {
      let email = toInput.trim().toLowerCase();
      if (!email.includes('@')) email = `${email}@flow.com`;
      if (!finalRecips.includes(email)) finalRecips.push(email);
    }

    if (finalRecips.length === 0) {
      alert('Please enter at least one verified recipient.');
      return;
    }

    if (!subject.trim()) {
      setShowSubjectConfirm(true);
      return;
    }

    executeSend(subject.trim());
  };

  return (
    <div
      className={`compose-modal ${modalState === 'maximized' ? 'maximized' : modalState === 'minimized' ? 'minimized' : ''}`}
      id="compose-modal"
      style={{ display: 'flex' }}
    >
      <div className="modal-header">
        <span className="modal-title">{title}</span>
        <div className="modal-controls">
          <button
            type="button"
            className="control-btn"
            id="compose-minimize"
            aria-label="Minimize"
            onClick={() => setModalState(modalState === 'minimized' ? 'normal' : 'minimized')}
          >
            —
          </button>
          <button
            type="button"
            className="control-btn"
            id="compose-maximize"
            aria-label="Maximize"
            title={modalState === 'maximized' ? 'Restore' : 'Maximize'}
            onClick={() => setModalState(modalState === 'maximized' ? 'normal' : 'maximized')}
          >
            {modalState === 'maximized' ? '⤡' : '⤢'}
          </button>
          <button
            type="button"
            className="control-btn"
            id="compose-close"
            aria-label="Close"
            disabled={isUploading}
            onClick={handleClose}
          >
            ✕
          </button>
        </div>
      </div>

      <form
        id="compose-form"
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {/* Recipients input */}
        <div className="compose-input-group to-input-group">
          <span className="to-label">To</span>
          <div className="chips-container" id="chips-container">
            {recipients.map((recip, index) => (
              <div key={index} className="recipient-chip" data-email={recip}>
                <div className="chip-avatar">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="chip-text">{recip}</span>
                <button
                  type="button"
                  className="chip-close"
                  onClick={() => removeRecipient(index)}
                >
                  ✕
                </button>
              </div>
            ))}
            <input
              type="text"
              id="email-to"
              placeholder={recipients.length === 0 ? 'Recipients' : ''}
              autoComplete="off"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleToKeyDown}
            />
          </div>
        </div>

        {/* Subject input */}
        <div className="compose-input-group">
          <input
            type="text"
            id="email-subject"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                bodyRef.current?.focus();
              }
            }}
          />
        </div>

        {/* Body input */}
        <div className="compose-body-group">
          <textarea
            ref={bodyRef}
            id="email-body"
            placeholder="Write email body here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {/* Attachments Chips List */}
        {attachments.length > 0 && (
          <div className="compose-attachments" id="compose-attachments" aria-live="polite">
            {attachments.map((att, idx) => (
              <div key={att._id || idx} className="compose-attachment-chip">
                <span
                  className="compose-attachment-label"
                  title={`${att.filename} (${formatFileSize(att.size)})`}
                >
                  {att.filename} · {formatFileSize(att.size)}
                </span>
                <button
                  type="button"
                  className="compose-attachment-remove"
                  aria-label={`Remove ${att.filename}`}
                  onClick={() => handleRemoveAttachment(att)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer controls */}
        <div className="modal-footer">
          <div className="footer-left">
            <button
              type="button"
              className="compose-attach-button"
              id="compose-attach"
              title="Attach files"
              aria-label="Attach files"
              disabled={isUploading || isSending}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.5 6.5 8.7 14.3a2.5 2.5 0 0 0 3.5 3.5l8-8a4.5 4.5 0 0 0-6.4-6.4l-8.5 8.5a6 6 0 0 0 8.5 8.5l7-7" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              id="compose-file-input"
              type="file"
              multiple
              hidden
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="btn-send"
              id="btn-send-email"
              disabled={isUploading || isSending}
              onClick={handleSendClick}
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>

          <div className="footer-right">
            <button
              type="button"
              className="btn-discard"
              id="btn-compose-discard"
              title="Discard"
              disabled={isUploading || isSending}
              onClick={handleDiscard}
            >
              <img src="/images/trash-can-regular-full.svg" alt="Discard" className="compose-discard-icon" />
            </button>
          </div>
        </div>
      </form>

      {/* Confirm Send Without Subject Popup */}
      {showSubjectConfirm && (
        <div className="confirm-dialog-overlay" style={{ display: 'flex' }}>
          <div className="confirm-dialog-card">
            <div className="confirm-dialog-title">Send without subject?</div>
            <div className="confirm-dialog-body">
              Are you sure you want to send this message without a subject?
            </div>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-dialog-cancel"
                onClick={() => setShowSubjectConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-dialog-confirm"
                onClick={() => {
                  setShowSubjectConfirm(false);
                  executeSend('');
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
