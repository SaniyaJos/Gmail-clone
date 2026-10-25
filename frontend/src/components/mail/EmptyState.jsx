import React from 'react';

const EMPTY_ICON_ATTRS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.6',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true'
};

const EMPTY_STATES = {
  inbox: {
    title: 'Your inbox is empty',
    subtitle: "You're all caught up. New mail will show up here."
  },
  starred: {
    title: 'No starred messages',
    subtitle: 'Stars let you give messages a special status to make them easier to find.'
  },
  sent: {
    title: 'No sent messages',
    subtitle: 'Messages you send will be listed here.'
  },
  drafts: {
    title: "You don't have any saved drafts",
    subtitle: "Saving a draft allows you to keep a message you aren't ready to send yet."
  },
  spam: {
    good: true,
    title: 'No spam, great!',
    subtitle: 'Messages detected as spam appear here and are deleted automatically after 30 days.'
  },
  bin: {
    title: 'Bin is empty',
    subtitle: 'Deleted messages stay here for 30 days before they are removed for good.'
  },
  all: {
    title: 'No mail yet',
    subtitle: 'Everything you send and receive will show up here.'
  },
  search: {
    title: 'No messages matched your search',
    subtitle: 'Try checking for typos or using different keywords.'
  }
};

function renderEmptySvg(type) {
  switch (type) {
    case 'starred':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'sent':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case 'drafts':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      );
    case 'spam':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case 'bin':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case 'search':
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'inbox':
    default:
      return (
        <svg {...EMPTY_ICON_ATTRS}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
  }
}

export default function EmptyState({ activeFolder, isSearch }) {
  const key = isSearch ? 'search' : (activeFolder || 'inbox');
  const state = EMPTY_STATES[key] || EMPTY_STATES.inbox;

  return (
    <div className="empty-state" id="empty-state-view" style={{ display: 'flex' }}>
      <div className={`empty-icon ${state.good ? 'is-good' : ''}`} id="empty-icon" aria-hidden="true">
        {renderEmptySvg(key)}
      </div>
      <div className="empty-title" id="empty-title">{state.title}</div>
      <div className="empty-subtitle" id="empty-subtitle">{state.subtitle}</div>
    </div>
  );
}
