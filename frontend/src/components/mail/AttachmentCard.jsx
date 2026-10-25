import React, { useState, useEffect } from 'react';
import { formatFileSize } from '../../utils/formatters';
import { getAuthHeaders, API_BASE } from '../../services/api';

export default function AttachmentCard({ email, attachment }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mimeType);

  useEffect(() => {
    let active = true;
    let objUrl = '';

    if (isImage && email?._id && attachment?._id) {
      fetch(`${API_BASE}/emails/${email._id}/attachments/${attachment._id}/preview`, {
        headers: getAuthHeaders()
      })
        .then((res) => {
          if (!res.ok) throw new Error('Preview unavailable');
          return res.blob();
        })
        .then((blob) => {
          if (active) {
            objUrl = URL.createObjectURL(blob);
            setPreviewUrl(objUrl);
          }
        })
        .catch(() => {
          if (active) setPreviewError(true);
        });
    }

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [email?._id, attachment?._id, isImage]);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const response = await fetch(
        `${API_BASE}/emails/${email._id}/attachments/${attachment._id}/download`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download error:', err);
      alert('Could not download file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const extension = attachment.filename?.includes('.')
    ? attachment.filename.split('.').pop().toUpperCase()
    : (attachment.mimeType ? attachment.mimeType.split('/').pop().toUpperCase() : 'FILE');

  return (
    <article
      className="email-attachment-card"
      title={`Click to download ${attachment.filename || 'attachment'}`}
      onClick={handleDownload}
    >
      {isImage ? (
        previewError ? (
          <span className="attachment-preview-unavailable">IMG</span>
        ) : (
          <img
            className="email-attachment-preview"
            alt={`Preview of ${attachment.filename || 'image attachment'}`}
            src={previewUrl}
          />
        )
      ) : (
        <span className="attachment-file-icon" aria-hidden="true">
          {extension.slice(0, 4)}
        </span>
      )}

      <div className="email-attachment-metadata">
        <div className="email-attachment-name" title={attachment.filename}>
          {attachment.filename || 'Unnamed attachment'}
        </div>
        <div className="email-attachment-type">
          {attachment.mimeType || 'File'} · {formatFileSize(attachment.size)}
        </div>
      </div>

      <button
        type="button"
        className="attachment-download-button"
        title="Download file"
        disabled={isDownloading}
        onClick={handleDownload}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
        <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
      </button>
    </article>
  );
}
