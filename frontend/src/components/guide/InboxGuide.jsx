import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  'All features',
  'Getting Started',
  'Inbox and Email Organization',
  'Search and Navigation',
  'Composing and Managing Emails',
  'Productivity Tools',
  'Appearance and Preferences'
];

const FEATURES = [
  {
    id: 'getting-around',
    category: 'Getting Started',
    icon: '⌂',
    name: 'Getting around InboxFlow',
    description: 'Use the sidebar to move between the mail folders and My Actions.',
    what: 'InboxFlow keeps your mail folders, labels, and extracted action items in the left navigation. The Help icon reopens this guide.',
    access: 'Use the navigation sidebar on the left of the inbox.',
    steps: [
      'Choose Inbox, Starred, Sent, Drafts, Spam, Bin, or All Mail to change the list.',
      'Choose My Actions to review tasks extracted from emails.',
      'Use the labels section to filter mail by one of your labels.'
    ],
    tips: ['On a narrow screen, use the menu button to open the sidebar.']
  },
  {
    id: 'inbox',
    category: 'Inbox and Email Organization',
    icon: '▤',
    name: 'Inbox',
    description: 'Review messages addressed to you and see unread counts.',
    what: 'The Inbox lists received messages that have not been moved to Bin or Spam. Its badge shows unread messages.',
    access: 'Choose Inbox in the left sidebar.',
    steps: [
      'Select a message row to open its conversation.',
      'Use the checkbox on a row to select messages for toolbar actions.',
      'Use Refresh to reload the current folder and its message counts.'
    ],
    tips: ['Conversation messages are grouped together when they share a thread.']
  },
  {
    id: 'search',
    category: 'Search and Navigation',
    icon: '⌕',
    name: 'Search mail',
    description: 'Find messages by words or use the advanced search fields.',
    what: 'Search checks your mail using the text or supported fields you enter. Advanced search builds a query for sender, recipient, subject, included words, and excluded words.',
    access: 'Use the Search mail field in the header. Select the sliders icon for advanced search.',
    steps: [
      'Type a term in Search mail; the list updates as you type.',
      'Press Enter to apply the search immediately.',
      'Press Escape in the search field to clear an active query.',
      'For a field-based search, open Advanced search, fill in one or more fields, then select Search.'
    ],
    tips: ['The search field searches the currently selected folder.']
  },
  {
    id: 'read-messages',
    category: 'Inbox and Email Organization',
    icon: '✉',
    name: 'Open and manage conversations',
    description: 'Read a message, browse its conversation, and reply or forward.',
    what: 'Opening a row displays the conversation and its message details. Available actions include replying, replying to all, forwarding, starring, and moving eligible messages.',
    access: 'Select a message row in a mail folder.',
    steps: [
      'Select the row to open its conversation.',
      'Use Reply, Reply all, or Forward when those actions are available.',
      'Use the star control to add or remove a star.',
      'Use the back control to return to the folder list.'
    ],
    tips: ['Messages in a conversation can be expanded or collapsed in the conversation view.']
  },
  {
    id: 'starred',
    category: 'Inbox and Email Organization',
    icon: '☆',
    name: 'Starred messages',
    description: 'Mark important messages with a star and find them later.',
    what: 'Starred is a folder view for messages you have starred. You can toggle a star from a row or an open message.',
    access: 'Use the star control on a message, then choose Starred in the sidebar.',
    steps: [
      'Select the star beside a message or in its open conversation.',
      'Choose Starred in the sidebar to filter to starred messages.',
      'Select the star again to remove it.'
    ],
    tips: ['Starred is a view; starring does not move a message out of its other folders.']
  },
  {
    id: 'labels',
    category: 'Inbox and Email Organization',
    icon: '◇',
    name: 'Custom labels',
    description: 'Create labels and apply them to messages for organization.',
    what: 'Labels are account-owned tags. Applying a label associates it with a message without moving or deleting the message.',
    access: 'Create labels from the Labels section in the sidebar. Manage a message’s labels from its open details or the bulk label controls.',
    steps: [
      'Select the plus button beside Labels and enter a label name.',
      'Select one or more messages and use the label controls, or open a message and manage its labels there.',
      'Choose a label in the sidebar to view messages associated with it.'
    ],
    tips: ['Renaming or deleting a label does not delete its emails.']
  },
  {
    id: 'read-unread',
    category: 'Inbox and Email Organization',
    icon: '✉',
    name: 'Mark as unread',
    description: 'Opening a message marks it read; use the envelope action to mark it unread again.',
    what: 'Unread messages contribute to the inbox unread count. The envelope action can mark eligible individual messages or selected messages unread.',
    access: 'Open a message to mark it read, or use an eligible row quick action or selection toolbar to mark it unread.',
    steps: [
      'Open a message to mark it read.',
      'For an individual eligible row, choose its envelope quick action to mark it unread.',
      'For multiple messages, select their checkboxes and choose the envelope action in the toolbar.',
      'The folder list and unread badges refresh after the update.'
    ],
    tips: ['The unread action is not offered in Drafts, Spam, or Bin.']
  },
  {
    id: 'spam',
    category: 'Inbox and Email Organization',
    icon: '!',
    name: 'Spam',
    description: 'Report unwanted messages and move messages back from Spam.',
    what: 'Messages can be reported as Spam from supported folders. In Spam, use Not spam to return a message to the Inbox.',
    access: 'Use the message or selection actions, then choose Spam in the sidebar to review reported mail.',
    steps: [
      'Select or open an eligible message and choose Report spam.',
      'In Spam, select or open a message and choose Not spam to move it to Inbox.',
      'Spam messages older than 30 days are automatically deleted.'
    ],
    tips: ['Reporting spam moves the message; it does not send a report outside InboxFlow.']
  },
  {
    id: 'bin',
    category: 'Inbox and Email Organization',
    icon: '▱',
    name: 'Bin and restore messages',
    description: 'Move messages to Bin and restore them when needed.',
    what: 'Deleting a message moves it to Bin. You can restore messages from there, or permanently delete them. Bin messages older than 30 days are automatically deleted.',
    access: 'Choose Bin in the sidebar.',
    steps: [
      'Move a message to Bin using its delete action.',
      'In Bin, select messages and choose Restore, or open a message and restore it.',
      'Use the permanent delete or Empty Bin action only when you intend to delete messages permanently.'
    ],
    tips: ['Permanent deletion cannot be undone.']
  },
  {
    id: 'compose',
    category: 'Composing and Managing Emails',
    icon: '↗',
    name: 'Compose and send email',
    description: 'Write a message, add recipients and files, then send it.',
    what: 'The compose window supports recipients, a subject, a message body, and file attachments.',
    access: 'Choose Compose in the sidebar.',
    steps: [
      'Enter one or more recipients, then add a subject and message.',
      'Use the attachment control to add supported files.',
      'Choose Send when the message is ready.'
    ],
    tips: ['Closing a non-empty compose window saves it as a draft.']
  },
  {
    id: 'undo-send',
    category: 'Composing and Managing Emails',
    icon: '⎌',
    name: 'Undo send',
    description: 'Cancel a sent message shortly after sending.',
    what: 'When you send a message, InboxFlow gives you an 8-second window with an Undo action to cancel the delivery and restore your draft.',
    access: 'Select Undo on the status notification that appears after sending.',
    steps: [
      'Send a message from the compose window.',
      'Select Undo on the notification in the bottom corner before it fades.',
      'The message reopens in the compose window for editing.'
    ],
    tips: ['Undo send is available for 8 seconds after sending.']
  },
  {
    id: 'action-engine',
    category: 'Productivity Tools',
    icon: '✓',
    name: 'Email-to-Action Engine',
    description: 'Automatically extract actionable tasks, deadlines, and priorities from your emails.',
    what: 'InboxFlow analyzes incoming email bodies to discover commitments, action items, dates, and urgency levels, organizing them into your interactive task board.',
    access: 'Select Extract Actions inside an email, or visit My Actions in the sidebar.',
    steps: [
      'Open any received email with tasks.',
      'Select the Extract Actions button at the top of the message.',
      'View extracted action items inline or track all items in My Actions.',
      'Mark tasks complete as you finish them.'
    ],
    tips: ['You can re-analyze an email at any time.']
  },
  {
    id: 'theme',
    category: 'Appearance and Preferences',
    icon: '◑',
    name: 'Light and Dark mode',
    description: 'Choose the visual style that suits your preferences.',
    what: 'Switch smoothly between clean light mode and high-contrast dark mode tailored for reading comfort.',
    access: 'Select the theme toggle in the navigation header or inside the account menu.',
    steps: [
      'Click the theme toggle in the header or account dropdown.',
      'Your preference is automatically saved for your signed-in account.'
    ],
    tips: ['Dark mode provides reduced eye strain in low-light environments.']
  }
];

const TOUR_STEPS = [
  {
    selector: '.app-sidebar',
    title: 'Your navigation sidebar',
    description: 'Move between Inbox, Starred, Sent, Drafts, Spam, Bin, All Mail, labels, and My Actions here.'
  },
  {
    selector: '#search-input',
    title: 'Find mail with search',
    description: 'Search the selected folder, or open Advanced search to search by sender, recipient, subject, included words, or excluded words.'
  },
  {
    selector: '.mail-list-container',
    title: 'Open and select messages',
    description: 'Select a row to open its conversation. Use row checkboxes to select messages for the toolbar actions.'
  },
  {
    selector: '#btn-compose',
    title: 'Compose a message',
    description: 'Start an email with recipients, subject, body, and optional attachments. Closing a non-empty compose window saves it as a draft.'
  },
  {
    selector: '#nav-starred',
    title: 'Star and organize',
    description: 'Star messages to find them in Starred. Create custom labels in the sidebar and apply them from message details or bulk actions.'
  },
  {
    selector: '#nav-bin',
    title: 'Bin and restore',
    description: 'Deleted messages go to Bin, where you can restore them. Messages in Bin are automatically deleted after 30 days.'
  },
  {
    selector: '#nav-actions',
    title: 'Turn email into action items',
    description: 'Open a message and use Extract Actions to find tasks, deadlines, and priorities. Review and track those items in My Actions.'
  },
  {
    selector: '#header-avatar',
    title: 'Theme and account preferences',
    description: 'Open the account menu to switch between light and dark themes or sign out.'
  },
  {
    selector: '#inboxflow-help-button',
    title: 'Reopen this guide any time',
    description: 'The Help icon opens this guide again. Browse the feature directory or restart this tour whenever you need a refresher.'
  }
];

export default function InboxGuide({ isOpen, onClose }) {
  const [guideView, setGuideView] = useState('welcome'); // 'welcome', 'directory', 'detail'
  const [activeCategory, setActiveCategory] = useState('All features');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [cardPlacement, setCardPlacement] = useState('bottom'); // 'bottom' or 'top'
  const [spotlightRect, setSpotlightRect] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setGuideView('welcome');
      setSelectedFeature(null);
      setIsTourActive(false);
      setSpotlightRect(null);
    }
  }, [isOpen]);

  const currentTourStep = TOUR_STEPS[tourIndex];

  // Update spotlight coordinates and compute card placement so it never blocks target
  useEffect(() => {
    if (!isTourActive || !currentTourStep) {
      setSpotlightRect(null);
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(currentTourStep.selector);
      if (!el) {
        setSpotlightRect(null);
        return;
      }

      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      const rect = el.getBoundingClientRect();
      const left = Math.max(0, rect.left - 4);
      const top = Math.max(0, rect.top - 4);
      const width = Math.max(1, Math.min(window.innerWidth - left, rect.width + 8));
      const height = Math.max(1, Math.min(window.innerHeight - top, rect.height + 8));

      setSpotlightRect({ left, top, width, height });

      // If highlighted target is in upper half of viewport, show card at the bottom.
      // If target is in lower half of viewport, show card at the top.
      const targetCenterY = rect.top + rect.height / 2;
      if (targetCenterY < window.innerHeight / 2) {
        setCardPlacement('bottom');
      } else {
        setCardPlacement('top');
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isTourActive, tourIndex, currentTourStep]);

  if (!isOpen && !isTourActive) return null;

  const filteredFeatures = FEATURES.filter((feat) => {
    const matchesCategory =
      activeCategory === 'All features' || feat.category === activeCategory;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      feat.name.toLowerCase().includes(term) ||
      feat.description.toLowerCase().includes(term) ||
      feat.what.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  const resultHeading = searchTerm.trim()
    ? `${filteredFeatures.length} result${filteredFeatures.length === 1 ? '' : 's'}`
    : activeCategory === 'All features' ? 'Explore features' : activeCategory;

  const startTour = () => {
    setIsTourActive(true);
    setTourIndex(0);
  };

  return (
    <>
      {/* Help Guide Dialog */}
      {isOpen && !isTourActive && (
        <div className="inboxflow-guide" id="inboxflow-guide" style={{ display: 'flex' }}>
          <div className="inboxflow-guide-backdrop" onClick={onClose} />
          <section
            className="inboxflow-guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inboxflow-guide-title"
          >
            <header className="inboxflow-guide-header">
              <div className="inboxflow-guide-brand">
                <span className="inboxflow-guide-mark" aria-hidden="true">?</span>
                <div>
                  <h2 className="inboxflow-guide-title" id="inboxflow-guide-title">
                    InboxFlow Guide
                  </h2>
                  <p className="inboxflow-guide-kicker">Help for the features in your inbox</p>
                </div>
              </div>
              <button
                type="button"
                className="inboxflow-guide-close"
                aria-label="Close InboxFlow Guide"
                title="Close"
                onClick={onClose}
              >
                &times;
              </button>
            </header>

            <div className="inboxflow-guide-content" id="inboxflow-guide-content">
              {/* 1. Welcome View */}
              {guideView === 'welcome' && (
                <section className="inboxflow-guide-welcome">
                  <p className="inboxflow-guide-eyebrow">Your help centre</p>
                  <h3>Welcome to InboxFlow Guide</h3>
                  <p className="inboxflow-guide-lead">
                    Discover your inbox, explore useful features, and learn how to get the most out of InboxFlow.
                  </p>
                  <p className="inboxflow-guide-context">
                    This guide can be reopened from the Help icon whenever you need it.
                  </p>
                  <div className="inboxflow-guide-actions">
                    <button
                      type="button"
                      className="inboxflow-guide-button inboxflow-guide-button-primary"
                      onClick={startTour}
                    >
                      Start Guided Tour
                    </button>
                    <button
                      type="button"
                      className="inboxflow-guide-button"
                      onClick={() => {
                        setActiveCategory('All features');
                        setGuideView('directory');
                      }}
                    >
                      Explore All Features
                    </button>
                  </div>
                </section>
              )}

              {/* 2. Directory View */}
              {guideView === 'directory' && (
                <div className="inboxflow-guide-directory">
                  <nav className="inboxflow-guide-sidebar" aria-label="Guide categories">
                    <button
                      type="button"
                      className="inboxflow-guide-button inboxflow-guide-back-menu-btn"
                      onClick={() => setGuideView('welcome')}
                      title="Back to main menu"
                    >
                      ← Main Menu
                    </button>
                    <p className="inboxflow-guide-sidebar-title">Categories</p>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className="inboxflow-guide-category"
                        aria-pressed={activeCategory === cat}
                        onClick={() => setActiveCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </nav>

                  <div className="inboxflow-guide-main">
                    <div className="inboxflow-guide-search-wrap">
                      <input
                        type="search"
                        id="inboxflow-guide-search"
                        className="inboxflow-guide-search"
                        placeholder="Search features by name or keyword"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          className="inboxflow-guide-clear"
                          id="inboxflow-guide-clear"
                          onClick={() => setSearchTerm('')}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <h3 className="inboxflow-guide-directory-heading">{resultHeading}</h3>

                    {filteredFeatures.length === 0 ? (
                      <div className="inboxflow-guide-empty">
                        <strong>No matching features</strong>
                        Try a different search, or clear the search to browse all features.
                        <div style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            className="inboxflow-guide-button"
                            onClick={() => {
                              setSearchTerm('');
                              setActiveCategory('All features');
                            }}
                          >
                            Clear search
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="inboxflow-guide-feature-list">
                        {filteredFeatures.map((feat) => (
                          <button
                            key={feat.id}
                            type="button"
                            className="inboxflow-guide-feature"
                            onClick={() => {
                              setSelectedFeature(feat);
                              setGuideView('detail');
                            }}
                          >
                            <span className="inboxflow-guide-feature-icon" aria-hidden="true">
                              {feat.icon}
                            </span>
                            <span>
                              <span className="inboxflow-guide-feature-name">{feat.name}</span>
                              <span className="inboxflow-guide-feature-description">
                                {feat.description}
                              </span>
                            </span>
                            <span aria-hidden="true">›</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Detail View */}
              {guideView === 'detail' && selectedFeature && (
                <article className="inboxflow-guide-detail">
                  <button
                    type="button"
                    className="inboxflow-guide-button inboxflow-guide-back"
                    onClick={() => setGuideView('directory')}
                  >
                    ← All features
                  </button>
                  <p className="inboxflow-guide-eyebrow">{selectedFeature.category}</p>
                  <h3>{selectedFeature.name}</h3>
                  <p className="inboxflow-guide-lead">{selectedFeature.description}</p>

                  <h4>What it does</h4>
                  <p>{selectedFeature.what}</p>

                  <h4>How to access it</h4>
                  <p>{selectedFeature.access}</p>

                  <h4>Steps</h4>
                  <ol>
                    {selectedFeature.steps.map((st, i) => (
                      <li key={i}>{st}</li>
                    ))}
                  </ol>

                  {selectedFeature.tips?.length > 0 && (
                    <div className="inboxflow-guide-tip">
                      <strong>Tip:</strong> {selectedFeature.tips.join(' ')}
                    </div>
                  )}
                </article>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Guided Tour Spotlight & Anti-blocking Card */}
      {isTourActive && currentTourStep && (
        <div
          className={`inboxflow-tour placement-${cardPlacement}`}
          id="inboxflow-tour"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: cardPlacement === 'top' ? 'flex-start' : 'flex-end',
            paddingTop: cardPlacement === 'top' ? '28px' : undefined,
            paddingBottom: cardPlacement === 'bottom' ? '28px' : undefined
          }}
        >
          <div
            className="inboxflow-tour-backdrop"
            onClick={() => setIsTourActive(false)}
          />
          {spotlightRect && (
            <div
              className="inboxflow-tour-spotlight"
              aria-hidden="true"
              style={{
                left: `${spotlightRect.left}px`,
                top: `${spotlightRect.top}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
                display: 'block'
              }}
            />
          )}
          <section
            className="inboxflow-tour-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inboxflow-tour-title"
          >
            <button
              type="button"
              className="inboxflow-tour-close"
              aria-label="Exit guided tour"
              title="Exit tour"
              onClick={() => setIsTourActive(false)}
            >
              &times;
            </button>
            <p className="inboxflow-tour-progress" id="inboxflow-tour-progress" aria-live="polite">
              Step {tourIndex + 1} of {TOUR_STEPS.length}
            </p>
            <h2 id="inboxflow-tour-title">{currentTourStep.title}</h2>
            <p className="inboxflow-tour-description" id="inboxflow-tour-description">
              {currentTourStep.description}
            </p>
            <div className="inboxflow-tour-actions">
              <button
                type="button"
                className="inboxflow-guide-button"
                id="inboxflow-tour-previous"
                disabled={tourIndex === 0}
                onClick={() => setTourIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="inboxflow-guide-button"
                onClick={() => setIsTourActive(false)}
              >
                Exit tour
              </button>
              <button
                type="button"
                className="inboxflow-guide-button inboxflow-guide-button-primary"
                id="inboxflow-tour-next"
                onClick={() => {
                  if (tourIndex < TOUR_STEPS.length - 1) {
                    setTourIndex((prev) => prev + 1);
                  } else {
                    setIsTourActive(false);
                  }
                }}
              >
                {tourIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
