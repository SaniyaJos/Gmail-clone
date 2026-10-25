import React from 'react';

export default function Sidebar({
  isOpen,
  activeFolder,
  activeLabelId,
  onSelectFolder,
  onSelectLabel,
  onOpenCompose,
  counts,
  customLabels,
  labelFeedback,
  onCreateLabel,
  onRenameLabel,
  onDeleteLabel
}) {
  const folders = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: '/images/inbox-solid-full.svg',
      badge: counts.inbox > 0 ? counts.inbox : null
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: '/images/star-regular-full.svg',
      badge: null
    },
    {
      id: 'sent',
      label: 'Sent',
      icon: '/images/paper-plane-regular-full.svg',
      iconClass: 'sent-icon-rotate',
      badge: null
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: '/images/file-regular-full.svg',
      badge: counts.drafts > 0 ? counts.drafts : null
    },
    {
      id: 'actions',
      label: 'My Actions',
      isSvg: 'actions',
      badge: counts.actions > 0 ? counts.actions : null
    },
    {
      id: 'spam',
      label: 'Spam',
      isSvg: 'spam',
      badge: counts.spam > 0 ? counts.spam : null
    },
    {
      id: 'bin',
      label: 'Bin',
      icon: '/images/trash-can-regular-full.svg',
      badge: null
    },
    {
      id: 'all',
      label: 'All Mail',
      icon: '/images/envelope-regular-full.svg',
      badge: counts.all > 0 ? counts.all : null
    }
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`.trim()}>
      <button type="button" className="compose-btn" id="btn-compose" onClick={onOpenCompose}>
        <img src="/images/pencil-solid-full.svg" alt="Compose" className="compose-btn-icon" />
        <span className="compose-text">Compose</span>
      </button>

      <nav className="sidebar-nav">
        {folders.map((folder) => {
          const isActive = !activeLabelId && activeFolder === folder.id;
          return (
            <a
              key={folder.id}
              href={`#${folder.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${folder.id}`}
              data-folder={folder.id}
              onClick={(e) => {
                e.preventDefault();
                onSelectFolder(folder.id);
              }}
            >
              {folder.isSvg === 'actions' ? (
                <svg
                  className="sidebar-icon action-engine-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              ) : folder.isSvg === 'spam' ? (
                <svg
                  className="spam-nav-icon"
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
              ) : (
                <img
                  src={folder.icon}
                  alt={folder.label}
                  className={`sidebar-icon ${folder.iconClass || ''}`.trim()}
                />
              )}
              <span className="nav-label">{folder.label}</span>
              {folder.badge && (
                <span className={`nav-badge ${folder.id === 'actions' ? 'actions-badge' : ''}`} id={`badge-${folder.id}`}>
                  {folder.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      <section className="custom-label-section" aria-labelledby="custom-label-heading">
        <div className="custom-label-heading">
          <span id="custom-label-heading">Labels</span>
          <button
            type="button"
            className="custom-label-add"
            id="create-label-button"
            aria-label="Create label"
            title="Create label"
            onClick={onCreateLabel}
          >
            +
          </button>
        </div>
        <div id="custom-label-list" className="custom-label-list" aria-live="polite">
          {customLabels.length === 0 ? (
            <div className="label-feedback">Create a label to organize mail.</div>
          ) : (
            customLabels.map((label) => (
              <div
                key={label._id}
                className={`custom-label-item ${label._id === activeLabelId ? 'active' : ''}`}
                data-label-item={label._id}
              >
                <button
                  type="button"
                  className="custom-label-select"
                  title={label.name}
                  onClick={() => onSelectLabel(label._id)}
                >
                  <span aria-hidden="true">◆</span>&nbsp;<span>{label.name}</span>
                </button>
                <button
                  type="button"
                  className="custom-label-edit"
                  aria-label={`Rename ${label.name}`}
                  title="Rename"
                  onClick={() => onRenameLabel(label)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="custom-label-delete"
                  aria-label={`Delete ${label.name}`}
                  title="Delete"
                  onClick={() => onDeleteLabel(label)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        {labelFeedback && (
          <div
            id="label-feedback"
            className={`label-feedback ${labelFeedback.isError ? 'is-error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {labelFeedback.text}
          </div>
        )}
      </section>
    </aside>
  );
}
