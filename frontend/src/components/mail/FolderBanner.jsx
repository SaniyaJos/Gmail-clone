import React from 'react';

const FOLDER_NOTICES = {
  bin: {
    text: 'Messages that have been in Bin for more than 30 days will be automatically deleted.',
    button: 'Empty Bin now'
  },
  spam: {
    text: 'Messages that have been in Spam for more than 30 days will be automatically deleted.',
    button: 'Delete all spam messages now'
  }
};

export default function FolderBanner({ activeFolder, emailCount, onEmptyFolder, hasSearchQuery }) {
  const notice = FOLDER_NOTICES[activeFolder];
  if (!notice || hasSearchQuery) return null;

  return (
    <div className="folder-banner" id="folder-banner" style={{ display: 'flex' }}>
      <span className="folder-banner-text" id="folder-banner-text">
        {notice.text}
      </span>
      {emailCount > 0 && (
        <button
          type="button"
          className="folder-banner-btn"
          id="folder-banner-btn"
          onClick={onEmptyFolder}
        >
          {notice.button}
        </button>
      )}
    </div>
  );
}
