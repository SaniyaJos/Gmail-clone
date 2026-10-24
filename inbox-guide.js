document.addEventListener('DOMContentLoaded', () => {
  const helpButton = document.getElementById('inboxflow-help-button');
  if (!helpButton) return;

  const guide = document.createElement('div');
  guide.className = 'inboxflow-guide';
  guide.id = 'inboxflow-guide';
  guide.hidden = true;
  guide.setAttribute('aria-hidden', 'true');
  guide.innerHTML = `
    <div class="inboxflow-guide-backdrop" data-guide-close></div>
    <section class="inboxflow-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="inboxflow-guide-title" tabindex="-1">
      <header class="inboxflow-guide-header">
        <div class="inboxflow-guide-brand">
          <span class="inboxflow-guide-mark" aria-hidden="true">?</span>
          <div>
            <h2 class="inboxflow-guide-title" id="inboxflow-guide-title" tabindex="-1">InboxFlow Guide</h2>
            <p class="inboxflow-guide-kicker">Help for the features in your inbox</p>
          </div>
        </div>
        <button type="button" class="inboxflow-guide-close" aria-label="Close InboxFlow Guide" title="Close">&times;</button>
      </header>
      <div class="inboxflow-guide-content" id="inboxflow-guide-content"></div>
    </section>
  `;

  const tour = document.createElement('div');
  tour.className = 'inboxflow-tour';
  tour.id = 'inboxflow-tour';
  tour.hidden = true;
  tour.setAttribute('aria-hidden', 'true');
  tour.innerHTML = `
    <div class="inboxflow-tour-backdrop" data-tour-exit></div>
    <div class="inboxflow-tour-spotlight" aria-hidden="true"></div>
    <section class="inboxflow-tour-card" role="dialog" aria-modal="true" aria-labelledby="inboxflow-tour-title" tabindex="-1">
      <button type="button" class="inboxflow-tour-close" data-tour-exit aria-label="Exit guided tour" title="Exit tour">&times;</button>
      <p class="inboxflow-tour-progress" id="inboxflow-tour-progress" aria-live="polite"></p>
      <h2 id="inboxflow-tour-title"></h2>
      <p class="inboxflow-tour-description" id="inboxflow-tour-description"></p>
      <div class="inboxflow-tour-actions">
        <button type="button" class="inboxflow-guide-button" id="inboxflow-tour-previous">Previous</button>
        <button type="button" class="inboxflow-guide-button" data-tour-exit>Exit tour</button>
        <button type="button" class="inboxflow-guide-button inboxflow-guide-button-primary" id="inboxflow-tour-next">Next</button>
      </div>
    </section>
  `;

  document.body.append(guide, tour);

  const content = guide.querySelector('#inboxflow-guide-content');
  const closeButton = guide.querySelector('.inboxflow-guide-close');
  const guideDialog = guide.querySelector('.inboxflow-guide-dialog');
  const tourCard = tour.querySelector('.inboxflow-tour-card');
  const tourSpotlight = tour.querySelector('.inboxflow-tour-spotlight');
  const tourTitle = tour.querySelector('#inboxflow-tour-title');
  const tourDescription = tour.querySelector('#inboxflow-tour-description');
  const tourProgress = tour.querySelector('#inboxflow-tour-progress');
  const previousButton = tour.querySelector('#inboxflow-tour-previous');
  const nextButton = tour.querySelector('#inboxflow-tour-next');

  const currentUser = readCurrentUser();
  const accountEmail = typeof currentUser?.email === 'string' ? currentUser.email.trim().toLowerCase() : '';
  const onboardingStorageKey = accountEmail
    ? `inboxflow-guide-onboarding:${encodeURIComponent(accountEmail)}`
    : null;
  const categories = [
    'Getting Started',
    'Inbox and Email Organization',
    'Search and Navigation',
    'Composing and Managing Emails',
    'Productivity Tools',
    'Appearance and Preferences'
  ];

  const features = [
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
      tips: ['On a narrow screen, use the menu button to open the sidebar.'],
      keywords: ['folders', 'navigation', 'menu', 'sidebar', 'start', 'getting started'],
      openSelector: '#nav-inbox',
      openLabel: 'Open Inbox'
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
      tips: ['Conversation messages are grouped together when they share a thread.'],
      keywords: ['mail', 'messages', 'unread', 'conversation', 'thread', 'inbox'],
      openSelector: '#nav-inbox',
      openLabel: 'Open Inbox'
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
      tips: ['The search field searches the currently selected folder.'],
      keywords: ['find', 'look for', 'filter', 'from', 'to', 'subject', 'where email', 'shortcut', 'keyboard'],
      openSelector: '#search-input',
      openLabel: 'Focus mail search',
      openMode: 'focus'
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
      tips: ['Messages in a conversation can be expanded or collapsed in the conversation view.'],
      keywords: ['open email', 'read', 'thread', 'reply', 'reply all', 'forward', 'conversation', 'details']
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
      tips: ['Starred is a view; starring does not move a message out of its other folders.'],
      keywords: ['favorite', 'important', 'flag', 'star', 'starred'],
      openSelector: '#nav-starred',
      openLabel: 'Open Starred'
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
      tips: ['Renaming or deleting a label does not delete its emails.'],
      keywords: ['organize', 'tag', 'categorize', 'create', 'manage', 'apply', 'label', 'labels', 'email', 'emails']
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
      tips: ['The unread action is not offered in Drafts, Spam, or Bin.'],
      keywords: ['unread count', 'read status', 'envelope', 'mark unread', 'mark read', 'bulk']
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
      tips: ['Reporting spam moves the message; it does not send a report outside InboxFlow.'],
      keywords: ['junk', 'unwanted', 'not spam', 'report', 'spam folder'],
      openSelector: '#nav-spam',
      openLabel: 'Open Spam'
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
      tips: ['Permanent deletion cannot be undone.'],
      keywords: ['trash', 'deleted', 'recover', 'undelete', 'restore', 'permanently delete', 'empty bin', 'email', 'emails'],
      openSelector: '#nav-bin',
      openLabel: 'Open Bin'
    },
    {
      id: 'all-mail',
      category: 'Inbox and Email Organization',
      icon: '▣',
      name: 'All Mail',
      description: 'Browse mail together in one folder view.',
      what: 'All Mail shows messages across the regular mail folders, excluding messages in Bin and Spam.',
      access: 'Choose All Mail in the sidebar.',
      steps: [
        'Choose All Mail to view the combined mail listing.',
        'Use search or the available message actions to narrow or manage the list.'
      ],
      tips: ['All Mail is a view; it does not create a separate copy of each message.'],
      keywords: ['every email', 'all messages', 'archive', 'mailbox'],
      openSelector: '#nav-all',
      openLabel: 'Open All Mail'
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
      tips: ['Closing a non-empty compose window saves it as a draft. Opening this guide does not close or change the compose window.'],
      keywords: ['write', 'new email', 'send message', 'recipient', 'attach', 'compose']
    },
    {
      id: 'drafts',
      category: 'Composing and Managing Emails',
      icon: '▤',
      name: 'Drafts',
      description: 'Continue editing saved messages that have not been sent.',
      what: 'Drafts stores messages you have started but not sent. Closing a non-empty compose window saves its contents as a draft.',
      access: 'Choose Drafts in the sidebar.',
      steps: [
        'Open Drafts to view saved messages.',
        'Select a draft to continue editing it in the compose window.',
        'Send it when it is ready, or close the compose window to save it again.'
      ],
      tips: ['The guide does not close or modify an open compose window.'],
      keywords: ['save', 'saved', 'unsent', 'continue writing', 'draft'],
      openSelector: '#nav-drafts',
      openLabel: 'Open Drafts'
    },
    {
      id: 'attachments',
      category: 'Composing and Managing Emails',
      icon: '⌁',
      name: 'Email attachments',
      description: 'Attach supported files to a draft or message.',
      what: 'The compose window lets you add supported image, document, spreadsheet, presentation, archive, and text files. Attachments are stored privately and downloads require an authorized session.',
      access: 'Choose the paperclip control in the compose window.',
      steps: [
        'Open Compose or edit a draft.',
        'Choose the attachment control and select one or more supported files.',
        'Wait for uploads to finish before sending or closing the compose window.'
      ],
      tips: ['The application enforces file type, count, and size limits.'],
      keywords: ['paperclip', 'upload', 'file', 'pdf', 'image', 'download']
    },
    {
      id: 'actions',
      category: 'Productivity Tools',
      icon: '✓',
      name: 'My Actions: Email-to-Action Engine',
      description: 'Extract task items from a message and track their status.',
      what: 'InboxFlow’s AI-powered Email-to-Action Engine can analyze an opened email to extract actionable tasks, deadlines, and priorities. Extracted tasks can be filtered and marked complete.',
      access: 'Open a message and choose Extract Actions, then visit My Actions in the sidebar.',
      steps: [
        'Open the message you want to analyze.',
        'Choose Extract Actions and wait for the result.',
        'Open My Actions to view tasks and filter by status or priority.',
        'Use a task’s completion control to update its status.'
      ],
      tips: ['Only run extraction on messages you intend to analyze. The guide itself never reads your email content.'],
      keywords: ['AI', 'Gemini', 'tasks', 'task extraction', 'deadline', 'priority', 'productivity', 'action items'],
      openSelector: '#nav-actions',
      openLabel: 'Open My Actions'
    },
    {
      id: 'appearance',
      category: 'Appearance and Preferences',
      icon: '◐',
      name: 'Light and dark themes',
      description: 'Switch the inbox between light and dark appearance.',
      what: 'The theme control in the account menu switches the application appearance and stores the preference for the signed-in account.',
      access: 'Choose the account icon in the top-right corner, then choose the theme control.',
      steps: [
        'Open the account menu using the account icon.',
        'Choose Light mode or Dark mode.',
        'The selected theme applies throughout the inbox and is remembered for that account.'
      ],
      tips: ['Theme preferences are stored locally by account email; the guide does not store credentials or tokens.'],
      keywords: ['appearance', 'color', 'dark mode', 'light mode', 'contrast', 'display', 'preference', 'change theme', 'switch theme'],
      openSelector: '#header-avatar',
      openLabel: 'Open account menu',
      openMode: 'account-menu'
    },
    {
      id: 'account',
      category: 'Appearance and Preferences',
      icon: '◉',
      name: 'Account menu and sign out',
      description: 'View the signed-in account or securely end the current session.',
      what: 'The account menu shows the signed-in profile and provides theme switching and sign out.',
      access: 'Choose the account icon in the top-right corner.',
      steps: [
        'Open the account menu to see the profile currently signed in.',
        'Use the theme control to switch appearance.',
        'Choose Sign out to end the local signed-in session.'
      ],
      tips: ['Sign out removes the saved current-user session from this browser.'],
      keywords: ['profile', 'user', 'logout', 'log out', 'sign out', 'account']
    }
  ];

  const tourSteps = [
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

  let activeCategory = 'All features';
  let guideReturnFocus = null;
  let tourIndex = -1;
  let tourReturnToGuide = false;
  let tourOpenedSidebar = false;
  let highlightedTarget = null;
  let isOnboarding = false;
  let onboardingTimer = null;

  function readCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (error) {
      console.warn('Could not read the signed-in account for InboxFlow Guide onboarding.', error);
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function getActiveContext() {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      return {
        label: activeNav.querySelector('.nav-label')?.textContent.trim() || 'your inbox',
        folder: activeNav.dataset.folder || 'inbox'
      };
    }
    const activeLabel = document.querySelector('.custom-label-item.active');
    if (activeLabel) {
      return { label: activeLabel.textContent.trim(), folder: 'label' };
    }
    return { label: 'your inbox', folder: 'inbox' };
  }

  function getContextFeatureId() {
    const folder = getActiveContext().folder;
    return ({
      inbox: 'inbox',
      drafts: 'drafts',
      spam: 'spam',
      bin: 'bin',
      starred: 'starred',
      sent: 'read-messages',
      all: 'all-mail',
      actions: 'actions',
      label: 'labels'
    })[folder] || 'inbox';
  }

  function getVisibleCategories(searchQuery = '') {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return categories.filter(category => {
      if (activeCategory !== 'All features' && !normalizedQuery && category !== activeCategory) return false;
      return features.some(feature => feature.category === category && (!normalizedQuery || matchesFeature(feature, normalizedQuery)));
    });
  }

  function matchesFeature(feature, query) {
    const fields = [
      feature.name,
      feature.description,
      feature.what,
      feature.access,
      ...feature.steps,
      ...feature.tips,
      ...feature.keywords
    ];
    const text = fields.join(' ').toLowerCase();
    if (text.includes(query)) return true;

    const stopWords = new Set(['a', 'an', 'and', 'are', 'do', 'for', 'how', 'i', 'in', 'is', 'me', 'of', 'the', 'to', 'use', 'using', 'where', 'with']);
    const terms = query.split(/[^a-z0-9]+/).filter(term => term && !stopWords.has(term));
    return terms.length > 0 && terms.every(term => text.includes(term));
  }

  function getFilteredFeatures(query = '') {
    const normalizedQuery = query.trim().toLowerCase();
    const contextFeatureId = getContextFeatureId();
    return features
      .filter(feature => {
        const inCategory = activeCategory === 'All features' || feature.category === activeCategory;
        return inCategory && (!normalizedQuery || matchesFeature(feature, normalizedQuery));
      })
      .sort((left, right) => Number(right.id === contextFeatureId) - Number(left.id === contextFeatureId));
  }

  function showWelcome() {
    const context = getActiveContext();
    content.innerHTML = `
      <section class="inboxflow-guide-welcome">
        <p class="inboxflow-guide-eyebrow">Your help centre</p>
        <h3>Welcome to InboxFlow Guide</h3>
        <p class="inboxflow-guide-lead">Discover your inbox, explore useful features, and learn how to get the most out of InboxFlow.</p>
        <p class="inboxflow-guide-context">You are currently viewing <strong>${escapeHtml(context.label)}</strong>. This guide can be reopened from the Help icon whenever you need it.</p>
        <div class="inboxflow-guide-actions">
          <button type="button" class="inboxflow-guide-button inboxflow-guide-button-primary" data-guide-action="start-tour">Start Guided Tour</button>
          <button type="button" class="inboxflow-guide-button" data-guide-action="directory">Explore All Features</button>
          <button type="button" class="inboxflow-guide-button" data-guide-action="search">Search the Guide</button>
          <button type="button" class="inboxflow-guide-button" data-guide-action="skip-onboarding" ${isOnboarding ? '' : 'hidden'}>Skip onboarding</button>
        </div>
      </section>
    `;
  }

  function showDirectory(focusSearch = false) {
    content.innerHTML = `
      <div class="inboxflow-guide-directory">
        <nav class="inboxflow-guide-sidebar" aria-label="Guide categories">
          <p class="inboxflow-guide-sidebar-title">Categories</p>
          <div id="inboxflow-guide-categories"></div>
        </nav>
        <section class="inboxflow-guide-main" aria-label="Feature directory">
          <div class="inboxflow-guide-search-wrap">
            <input type="search" class="inboxflow-guide-search" id="inboxflow-guide-search" aria-label="Search the guide" placeholder="Search the guide">
            <button type="button" class="inboxflow-guide-clear" id="inboxflow-guide-clear" hidden>Clear</button>
          </div>
          <div id="inboxflow-guide-results" aria-live="polite" aria-relevant="additions text"></div>
          <div class="inboxflow-guide-detail-actions">
            <button type="button" class="inboxflow-guide-button inboxflow-guide-button-primary" data-guide-action="restart-tour">Start / Restart Guided Tour</button>
          </div>
        </section>
      </div>
    `;

    const searchInput = content.querySelector('#inboxflow-guide-search');
    const clearButton = content.querySelector('#inboxflow-guide-clear');
    const update = () => renderDirectory(searchInput.value);
    searchInput.addEventListener('input', () => {
      clearButton.hidden = !searchInput.value;
      activeCategory = 'All features';
      update();
    });
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      clearButton.hidden = true;
      activeCategory = 'All features';
      update();
      searchInput.focus();
    });
    update();
    if (focusSearch) searchInput.focus();
  }

  function renderDirectory(query = '') {
    const categoryNav = content.querySelector('#inboxflow-guide-categories');
    const results = content.querySelector('#inboxflow-guide-results');
    if (!categoryNav || !results) return;

    const availableCategories = getVisibleCategories(query);
    if (activeCategory !== 'All features' && !availableCategories.includes(activeCategory)) {
      activeCategory = 'All features';
    }
    categoryNav.innerHTML = ['All features', ...availableCategories].map(category => `
      <button type="button" class="inboxflow-guide-category" data-guide-category="${escapeHtml(category)}" aria-pressed="${String(category === activeCategory)}">${escapeHtml(category)}</button>
    `).join('');
    categoryNav.querySelectorAll('[data-guide-category]').forEach(button => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.guideCategory;
        renderDirectory(content.querySelector('#inboxflow-guide-search')?.value || '');
      });
    });

    const matchingFeatures = getFilteredFeatures(query);
    if (matchingFeatures.length === 0) {
      results.innerHTML = `
        <div class="inboxflow-guide-empty">
          <strong>No matching features</strong>
          Try a different search, or clear the search to browse all features.
          <div><button type="button" class="inboxflow-guide-button" data-guide-clear-search>Clear search</button></div>
        </div>
      `;
      results.querySelector('[data-guide-clear-search]').addEventListener('click', () => {
        const searchInput = content.querySelector('#inboxflow-guide-search');
        searchInput.value = '';
        content.querySelector('#inboxflow-guide-clear').hidden = true;
        activeCategory = 'All features';
        renderDirectory('');
        searchInput.focus();
      });
      return;
    }

    const resultHeading = query.trim()
      ? `${matchingFeatures.length} result${matchingFeatures.length === 1 ? '' : 's'}`
      : activeCategory === 'All features' ? 'Explore features' : activeCategory;
    results.innerHTML = `
      <h3 class="inboxflow-guide-directory-heading">${escapeHtml(resultHeading)}</h3>
      <div class="inboxflow-guide-feature-list">
        ${matchingFeatures.map(feature => `
          <button type="button" class="inboxflow-guide-feature" data-guide-feature="${escapeHtml(feature.id)}">
            <span class="inboxflow-guide-feature-icon" aria-hidden="true">${escapeHtml(feature.icon)}</span>
            <span>
              <span class="inboxflow-guide-feature-name">${escapeHtml(feature.name)}</span>
              <span class="inboxflow-guide-feature-description">${escapeHtml(feature.description)}</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        `).join('')}
      </div>
    `;
    results.querySelectorAll('[data-guide-feature]').forEach(button => {
      button.addEventListener('click', () => showFeature(button.dataset.guideFeature));
    });
  }

  function showFeature(featureId) {
    const feature = features.find(item => item.id === featureId);
    if (!feature) return;
    content.innerHTML = `
      <article class="inboxflow-guide-detail">
        <button type="button" class="inboxflow-guide-button inboxflow-guide-back" data-guide-action="back-directory">← All features</button>
        <p class="inboxflow-guide-eyebrow">${escapeHtml(feature.category)}</p>
        <h3>${escapeHtml(feature.name)}</h3>
        <p class="inboxflow-guide-lead">${escapeHtml(feature.description)}</p>
        <h4>What it does</h4>
        <p>${escapeHtml(feature.what)}</p>
        <h4>How to access it</h4>
        <p>${escapeHtml(feature.access)}</p>
        <h4>Steps</h4>
        <ol>${feature.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        ${feature.tips.length ? `<div class="inboxflow-guide-tip"><strong>Tip:</strong> ${feature.tips.map(escapeHtml).join(' ')}</div>` : ''}
        ${feature.openSelector ? `<div class="inboxflow-guide-detail-actions"><button type="button" class="inboxflow-guide-button inboxflow-guide-button-primary" data-guide-open-feature="${escapeHtml(feature.id)}">${escapeHtml(feature.openLabel)}</button></div>` : ''}
      </article>
    `;
    content.querySelector('[data-guide-action="back-directory"]').addEventListener('click', () => showDirectory());
    const openButton = content.querySelector('[data-guide-open-feature]');
    if (openButton) openButton.addEventListener('click', () => openFeature(feature));
    content.querySelector('.inboxflow-guide-back').focus();
  }

  function openFeature(feature) {
    const target = document.querySelector(feature.openSelector);
    closeGuide();
    if (!target) return;

    if (feature.openMode === 'focus') {
      target.focus();
      return;
    }
    if (feature.openMode === 'account-menu') {
      const dropdown = document.getElementById('account-dropdown');
      if (dropdown && dropdown.style.display !== 'flex') helpButton.ownerDocument.getElementById('header-avatar')?.click();
      window.setTimeout(() => dropdown?.querySelector('.account-theme-toggle')?.focus(), 0);
      return;
    }
    target.click();
  }

  function openGuide({ onboarding = false } = {}) {
    if (tourReturnToGuide && !tour.hidden) endTour(false);
    isOnboarding = onboarding;
    guideReturnFocus = onboarding ? null : document.activeElement;
    showWelcome();
    guide.hidden = false;
    guide.setAttribute('aria-hidden', 'false');
    closeButton.focus();
    if (onboarding) markOnboardingSeen();
  }

  function closeGuide(restoreFocus = true) {
    if (!tour.hidden) endTour(false);
    guide.hidden = true;
    guide.setAttribute('aria-hidden', 'true');
    if (restoreFocus && guideReturnFocus?.isConnected && typeof guideReturnFocus.focus === 'function') {
      guideReturnFocus.focus({ preventScroll: true });
    }
    guideReturnFocus = null;
    isOnboarding = false;
  }

  function markOnboardingSeen() {
    if (!onboardingStorageKey) return;
    try {
      localStorage.setItem(onboardingStorageKey, 'seen');
    } catch (error) {
      console.warn('Could not save the InboxFlow Guide onboarding preference.', error);
    }
  }

  function onboardingWasSeen() {
    if (!onboardingStorageKey) return true;
    try {
      return localStorage.getItem(onboardingStorageKey) === 'seen';
    } catch (error) {
      console.warn('Could not read the InboxFlow Guide onboarding preference.', error);
      return true;
    }
  }

  function revealTourTarget(target) {
    const sidebar = target.closest('.app-sidebar');
    if (sidebar && window.innerWidth <= 768 && !sidebar.classList.contains('open')) {
      sidebar.classList.add('open');
      tourOpenedSidebar = true;
    }
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto'
    });
  }

  function isVisible(element) {
    if (!element || !element.isConnected || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function showTourStep(index, direction = 1) {
    highlightedTarget = null;
    tourSpotlight.hidden = true;
    let candidate = index;
    while (candidate >= 0 && candidate < tourSteps.length) {
      const target = document.querySelector(tourSteps[candidate].selector);
      if (isVisible(target)) {
        if (tourOpenedSidebar && !target.closest('.app-sidebar')) {
          document.querySelector('.app-sidebar')?.classList.remove('open');
          tourOpenedSidebar = false;
        }
        tourIndex = candidate;
        revealTourTarget(target);
        highlightedTarget = target;
        updateTourSpotlight();
        tourProgress.textContent = `${tourIndex + 1} of ${tourSteps.length}`;
        tourTitle.textContent = tourSteps[tourIndex].title;
        tourDescription.textContent = tourSteps[tourIndex].description;
        previousButton.disabled = tourIndex === 0;
        nextButton.textContent = tourIndex === tourSteps.length - 1 ? 'Finish' : 'Next';
        nextButton.focus();
        return;
      }
      candidate += direction;
    }
    endTour(true);
  }

  function updateTourSpotlight() {
    if (!highlightedTarget || tour.hidden || !isVisible(highlightedTarget)) {
      tourSpotlight.hidden = true;
      return;
    }
    const rect = highlightedTarget.getBoundingClientRect();
    const left = Math.max(0, rect.left - 4);
    const top = Math.max(0, rect.top - 4);
    tourSpotlight.style.left = `${left}px`;
    tourSpotlight.style.top = `${top}px`;
    tourSpotlight.style.width = `${Math.max(1, Math.min(window.innerWidth - left, rect.width + 8))}px`;
    tourSpotlight.style.height = `${Math.max(1, Math.min(window.innerHeight - top, rect.height + 8))}px`;
    tourSpotlight.hidden = false;
  }

  function startTour(fromGuide = true) {
    tourReturnToGuide = fromGuide && !isOnboarding;
    guide.hidden = true;
    guide.setAttribute('aria-hidden', 'true');
    tour.hidden = false;
    tour.setAttribute('aria-hidden', 'false');
    tourOpenedSidebar = false;
    window.addEventListener('resize', updateTourSpotlight);
    window.addEventListener('scroll', updateTourSpotlight, true);
    showTourStep(0, 1);
  }

  function endTour(completed) {
    highlightedTarget = null;
    tourSpotlight.hidden = true;
    window.removeEventListener('resize', updateTourSpotlight);
    window.removeEventListener('scroll', updateTourSpotlight, true);
    if (tourOpenedSidebar) document.querySelector('.app-sidebar')?.classList.remove('open');
    tourOpenedSidebar = false;
    tour.hidden = true;
    tour.setAttribute('aria-hidden', 'true');

    if (completed) markOnboardingSeen();
    if (tourReturnToGuide) {
      guide.hidden = false;
      guide.setAttribute('aria-hidden', 'false');
      showDirectory();
      guide.querySelector('#inboxflow-guide-title').focus?.();
    } else {
      guide.hidden = true;
      guide.setAttribute('aria-hidden', 'true');
      if (guideReturnFocus?.isConnected && typeof guideReturnFocus.focus === 'function') {
        guideReturnFocus.focus({ preventScroll: true });
      }
      guideReturnFocus = null;
    }
    tourReturnToGuide = false;
  }

  function getFocusable(container) {
    return Array.from(container.querySelectorAll('button:not(:disabled):not([hidden]), input:not(:disabled):not([hidden]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0);
  }

  function trapFocus(event, container) {
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  helpButton.addEventListener('click', () => {
    if (onboardingTimer !== null) {
      window.clearTimeout(onboardingTimer);
      onboardingTimer = null;
      if (!onboardingWasSeen()) markOnboardingSeen();
    }
    openGuide();
  });
  closeButton.addEventListener('click', () => closeGuide());
  guide.addEventListener('click', event => {
    if (event.target.closest('[data-guide-close]')) closeGuide();
  });
  guide.addEventListener('click', event => {
    const button = event.target.closest('[data-guide-action]');
    if (!button) return;
    switch (button.dataset.guideAction) {
      case 'start-tour':
        startTour(!isOnboarding);
        break;
      case 'restart-tour':
        startTour(true);
        break;
      case 'directory':
        activeCategory = 'All features';
        showDirectory();
        break;
      case 'search':
        activeCategory = 'All features';
        showDirectory(true);
        break;
      case 'back-directory':
        showDirectory();
        break;
      case 'skip-onboarding':
        markOnboardingSeen();
        closeGuide();
        break;
      default:
        break;
    }
  });
  tour.addEventListener('click', event => {
    if (event.target.closest('[data-tour-exit]')) endTour(true);
  });
  previousButton.addEventListener('click', () => showTourStep(tourIndex - 1, -1));
  nextButton.addEventListener('click', () => {
    if (tourIndex === tourSteps.length - 1) {
      endTour(true);
    } else {
      showTourStep(tourIndex + 1, 1);
    }
  });

  document.addEventListener('keydown', event => {
    if (!guide.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeGuide();
      } else {
        trapFocus(event, guideDialog);
      }
    } else if (!tour.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        endTour(true);
      } else if (event.key === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        nextButton.click();
      } else if (event.key === 'ArrowLeft' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault();
        previousButton.click();
      } else {
        trapFocus(event, tourCard);
      }
    }
  });

  if (currentUser?.token && accountEmail && !onboardingWasSeen()) {
    onboardingTimer = window.setTimeout(() => {
      if (!onboardingWasSeen()) openGuide({ onboarding: true });
    }, 700);
  }

  window.addEventListener('pagehide', () => {
    if (onboardingTimer !== null) window.clearTimeout(onboardingTimer);
    window.removeEventListener('resize', updateTourSpotlight);
    window.removeEventListener('scroll', updateTourSpotlight, true);
  }, { once: true });
});
