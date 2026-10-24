/* Gmail Clone Inbox Dashboard */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. AUTH & SESSION CHECK
  // ==========================================
  const currentUserJson = localStorage.getItem('currentUser');
  if (!currentUserJson) {
    alert('Please sign in first.');
    window.location.href = 'signin.html';
    return;
  }

  const currentUser = JSON.parse(currentUserJson);
  if (!currentUser.token) {
    localStorage.removeItem('currentUser');
    alert('Please sign in again with the backend running to continue securely.');
    window.location.href = 'signin.html';
    return;
  }
  const userEmail = currentUser.email;
  const authToken = currentUser.token;

  function tokenHeaders(headers = {}) {
    if (!authToken) {
      throw new Error('Your secure sign-in session is missing. Please sign in again to use attachments.');
    }
    return { ...headers, Authorization: `Bearer ${authToken}` };
  }

  function getAvatarColor(identifier = '') {
    const colors = [
      '#7b1fa2', // Purple
      '#1a73e8', // Google Blue
      '#0f9d58', // Green
      '#d93025', // Red
      '#e65100', // Deep Orange
      '#00897b', // Teal
      '#3949ab', // Indigo
      '#8e24aa', // Dark Violet
      '#c2185b', // Pink
      '#0288d1'  // Light Blue
    ];
    let hash = 0;
    const str = String(identifier).toLowerCase();
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Set avatar initial title and bind dropdown
  const headerAvatar = document.getElementById('header-avatar');
  const accountDropdown = document.getElementById('account-dropdown');
  const dropdownAvatar = document.getElementById('dropdown-avatar');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownEmail = document.getElementById('dropdown-email');
  const btnLogout = document.getElementById('btn-dropdown-logout');

  if (headerAvatar) {
    const userDisplayName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || userEmail;
    const userInitial = (currentUser.firstName ? currentUser.firstName.charAt(0) : (userEmail ? userEmail.charAt(0) : 'U')).toUpperCase();
    const avatarColor = getAvatarColor(userEmail || currentUser.firstName || 'user');

    headerAvatar.textContent = userInitial;
    headerAvatar.style.backgroundColor = avatarColor;
    headerAvatar.title = `${userDisplayName} (${userEmail})`;

    if (dropdownAvatar && dropdownName && dropdownEmail) {
      dropdownAvatar.textContent = userInitial;
      dropdownAvatar.style.backgroundColor = avatarColor;
      dropdownName.textContent = userDisplayName;
      dropdownEmail.textContent = userEmail;
    }

    // Toggle dropdown on avatar click
    headerAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (accountDropdown.style.display === 'none' || accountDropdown.style.display === '') {
        accountDropdown.style.display = 'flex';
      } else {
        accountDropdown.style.display = 'none';
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (accountDropdown && accountDropdown.style.display === 'flex') {
        if (!accountDropdown.contains(e.target) && e.target !== headerAvatar) {
          accountDropdown.style.display = 'none';
        }
      }
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.href = 'signin.html';
    });
  }

  // ==========================================
  // 2. CONFIGURATION & STATE
  // ==========================================
  const API_BASE = 'http://localhost:5000/api';

  let activeFolder = 'inbox';
  let activeLabelId = null;
  let customLabels = [];
  let activeSearchQuery = '';
  let searchDebounceTimer;
  let emailFetchSequence = 0;
  let emailListCache = [];
  let selectedEmailIds = new Set();
  let currentOpenEmail = null;
  let currentDraftId = null; // _id of the draft being edited in compose modal (null = new message)
  let composeAttachments = [];
  let attachmentUploadInProgress = false;
  let attachmentRenderSequence = 0;
  let attachmentObjectUrls = [];

  // Conversation Threading State
  let currentThreadEmails = [];
  let currentThreadActiveEmails = [];
  let currentThreadDeletedEmails = [];
  let currentMainEmail = null;
  let currentConversationThreadId = null;
  let activeThreadId = null;
  let activeInReplyTo = null;

  // Bin & Spam keep emails for this many days before the backend deletes them automatically.
  // (Must match RETENTION_DAYS in backend/services/cleanupService.js)
  const RETENTION_DAYS = 30;

  // Text for the notice banner + confirmation dialog of each folder that is auto-cleaned
  const FOLDER_NOTICES = {
    bin: {
      text: `Messages that have been in Bin for more than ${RETENTION_DAYS} days will be automatically deleted.`,
      button: 'Empty Bin now',
      dialogTitle: 'Empty Bin now?',
      dialogBody: 'All messages in Bin will be permanently deleted. This cannot be undone.'
    },
    spam: {
      text: `Messages that have been in Spam for more than ${RETENTION_DAYS} days will be automatically deleted.`,
      button: 'Delete all spam messages now',
      dialogTitle: 'Delete all spam messages now?',
      dialogBody: 'All messages in Spam will be permanently deleted. This cannot be undone.'
    }
  };

  // Same icon as the sidebar Spam item (used in row hover actions)
  const SPAM_ICON_SVG = '<svg class="action-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  // ==========================================
  // 3. DOM ELEMENT REFERENCES
  // ==========================================

  // Navigation & List Views
  const navItems = document.querySelectorAll('.nav-item');
  const emptyStateView = document.getElementById('empty-state-view');
  const mailListWrapper = document.getElementById('mail-list-wrapper');
  const emailListUl = document.getElementById('email-list');
  const mailCountRange = document.getElementById('mail-count-range');
  const customLabelList = document.getElementById('custom-label-list');
  const createLabelButton = document.getElementById('create-label-button');
  const labelFeedback = document.getElementById('label-feedback');
  const bulkLabelActions = document.getElementById('bulk-label-actions');
  const bulkLabelSelect = document.getElementById('bulk-label-select');
  const bulkLabelApply = document.getElementById('bulk-label-apply');
  const bulkLabelRemove = document.getElementById('bulk-label-remove');
  const emailLabelChips = document.getElementById('email-label-chips');
  const emailLabelOptions = document.getElementById('email-label-options');
  const emailLabelPicker = document.getElementById('email-label-picker');

  // Toolbar Action Controls
  const selectAllCheckbox = document.getElementById('select-all');
  const deleteActionBarBtn = document.getElementById('action-delete');
  const restoreActionBarBtn = document.getElementById('action-restore');
  const unreadActionBarBtn = document.getElementById('action-unread');
  const readActionBarBtn = document.getElementById('action-read');
  const refreshActionBarBtn = document.getElementById('action-refresh');
  const spamActionBarBtn = document.getElementById('action-spam');
  const notSpamActionBarBtn = document.getElementById('action-not-spam');

  // Bin / Spam notice banner + confirmation dialog
  const folderBanner = document.getElementById('folder-banner');
  const folderBannerText = document.getElementById('folder-banner-text');
  const folderBannerBtn = document.getElementById('folder-banner-btn');
  const confirmEmptyDialog = document.getElementById('confirm-empty-dialog');
  const confirmEmptyTitle = document.getElementById('confirm-empty-title');
  const confirmEmptyBody = document.getElementById('confirm-empty-body');
  const btnCancelEmpty = document.getElementById('btn-cancel-empty');
  const btnConfirmEmpty = document.getElementById('btn-confirm-empty');

  // Search & Filter Controls
  const searchInput = document.getElementById('search-input');
  const filterToggle = document.getElementById('filter-toggle');
  const searchFilterPanel = document.getElementById('search-filter-panel');
  const searchFilterForm = document.getElementById('search-filter-panel');
  const filterClearBtn = document.getElementById('filter-clear');

  // Sidebar Controls
  const sidebarToggleBtn = document.querySelector('.sidebar-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');

  // Compose Modal Elements
  const composeBtn = document.getElementById('btn-compose');
  const composeModal = document.getElementById('compose-modal');
  const composeModalTitle = composeModal ? composeModal.querySelector('.modal-title') : null;
  const composeForm = document.getElementById('compose-form');
  const composeCloseBtn = document.getElementById('compose-close');
  const composeMinimizeBtn = document.getElementById('compose-minimize');
  const composeMaximizeBtn = document.getElementById('compose-maximize');
  const composeDiscardBtn = document.getElementById('btn-compose-discard');
  const emailToInput = document.getElementById('email-to');
  const chipsContainer = document.getElementById('chips-container');
  const emailSubjectInput = document.getElementById('email-subject');
  const emailBodyInput = document.getElementById('email-body');
  const composeAttachButton = document.getElementById('compose-attach');
  const composeFileInput = document.getElementById('compose-file-input');
  const composeAttachmentsList = document.getElementById('compose-attachments');

  // Details Modal Elements
  const emailDetailsModal = document.getElementById('email-details-modal');
  const btnDetailsBack = document.getElementById('btn-details-back');
  const detailsActionUnread = document.getElementById('details-action-unread');
  const detailsActionRestore = document.getElementById('details-action-restore');
  const detailsActionDelete = document.getElementById('details-action-delete');
  const detailsActionSpam = document.getElementById('details-action-spam');
  const detailsActionNotSpam = document.getElementById('details-action-not-spam');
  const replyForwardBar = document.getElementById('details-reply-forward-bar');
  const btnDetailReply = document.getElementById('btn-detail-reply');
  const btnDetailReplyAll = document.getElementById('btn-detail-reply-all');
  const btnDetailForward = document.getElementById('btn-detail-forward');
  const btnHeaderStar = document.getElementById('btn-header-star');
  const btnHeaderReply = document.getElementById('btn-header-reply');
  const btnHeaderForward = document.getElementById('btn-header-forward');
  const btnHeaderDelete = document.getElementById('btn-header-delete');
  const threadDeletedBanner = document.getElementById('thread-deleted-banner');
  const threadDeletedText = document.getElementById('thread-deleted-text');
  const btnViewDeletedMsg = document.getElementById('btn-view-deleted-msg');
  const btnDeleteForeverMsg = document.getElementById('btn-delete-forever-msg');
  const threadDeletedMessages = document.getElementById('thread-deleted-messages');
  const threadOlderMessages = document.getElementById('thread-older-messages');
  const spamWarning = document.getElementById('spam-warning');
  const spamWarningReasons = document.getElementById('spam-warning-reasons');
  const detailsStarButton = document.getElementById('details-star-button');
  const detailsStarIcon = detailsStarButton.querySelector('.details-star-icon');
  const detailsSubject = document.getElementById('details-subject');
  const detailsSenderInfo = document.getElementById('details-sender-info');
  const detailsSenderAvatar = document.getElementById('details-sender-avatar');
  const detailsSenderName = document.getElementById('details-sender-name');
  const detailsSenderEmail = document.getElementById('details-sender-email');
  const detailsReceiverEmail = document.getElementById('details-receiver-email');
  const detailsTimestamp = document.getElementById('details-timestamp');
  const detailsContent = document.getElementById('details-content');
  const emailInfoToggle = document.getElementById('email-info-toggle');
  const emailInfoPanel = document.getElementById('email-info-panel');
  const emailInfoFrom = document.getElementById('email-info-from');
  const emailInfoTo = document.getElementById('email-info-to');
  const emailInfoDate = document.getElementById('email-info-date');
  const emailInfoSubject = document.getElementById('email-info-subject');
  const emailAttachmentsSection = document.getElementById('email-attachments');
  const emailAttachmentsList = document.getElementById('email-attachments-list');

  // Email-to-Action Engine DOM Elements
  const btnExtractActions = document.getElementById('btn-extract-actions');
  const btnExtractText = document.getElementById('btn-extract-text');
  const btnExtractSpinner = document.getElementById('btn-extract-spinner');
  const emailTasksSection = document.getElementById('email-tasks-section');
  const emailTasksCount = document.getElementById('email-tasks-count');
  const btnReExtract = document.getElementById('btn-re-extract');
  const emailTasksList = document.getElementById('email-tasks-list');

  const actionsPanelView = document.getElementById('actions-panel-view');
  const actionsTasksContainer = document.getElementById('actions-tasks-container');
  const actionsEmptyState = document.getElementById('actions-empty-state');
  const actionsLoadingState = document.getElementById('actions-loading');
  const actionsBanner = document.getElementById('actions-banner');
  const actionPriorityFilter = document.getElementById('action-priority-filter');
  const actionTabButtons = document.querySelectorAll('.action-tab-btn');
  const badgeActions = document.getElementById('badge-actions');

  let activeTaskFilter = 'all';
  let activePriorityFilter = '';
  let actionsTasksCache = [];
  let emailTasksCache = [];

  // ==========================================
  // 4. API SERVICE HELPERS
  // ==========================================

  function setLabelFeedback(message, isError = false) {
    labelFeedback.textContent = message;
    labelFeedback.classList.toggle('is-error', isError);
  }

  async function labelRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: tokenHeaders(options.headers || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'The label operation could not be completed.');
    }
    return data;
  }

  function renderLabelSidebar() {
    customLabelList.innerHTML = customLabels.map(label => `
      <div class="custom-label-item ${label._id === activeLabelId ? 'active' : ''}" data-label-item="${label._id}">
        <button type="button" class="custom-label-select" data-select-label="${label._id}" title="${escapeHtml(label.name)}">
          <span aria-hidden="true">◆</span>&nbsp;<span>${escapeHtml(label.name)}</span>
        </button>
        <button type="button" class="custom-label-edit" data-rename-label="${label._id}" aria-label="Rename ${escapeHtml(label.name)}" title="Rename">✎</button>
        <button type="button" class="custom-label-delete" data-delete-label="${label._id}" aria-label="Delete ${escapeHtml(label.name)}" title="Delete">×</button>
      </div>
    `).join('');
    if (!customLabels.length && !labelFeedback.textContent) {
      customLabelList.innerHTML = '<div class="label-feedback">Create a label to organize mail.</div>';
    }

    bulkLabelSelect.innerHTML = '<option value="">Choose label</option>' + customLabels
      .map(label => `<option value="${label._id}">${escapeHtml(label.name)}</option>`).join('');
    renderEmailLabelOptions();
  }

  async function loadLabels() {
    try {
      customLabels = await labelRequest(`${API_BASE}/labels`);
      if (activeLabelId && !customLabels.some(label => label._id === activeLabelId)) {
        activeLabelId = null;
      }
      renderLabelSidebar();
      if (currentOpenEmail) renderEmailLabelOptions();
      if (Array.isArray(emailListCache) && emailListCache.length > 0) {
        renderEmailList(emailListCache);
      }
    } catch (err) {
      console.error('Error loading labels:', err);
      setLabelFeedback(err.message, true);
    }
  }

  async function changeEmailLabels(emailIds, labelId, action) {
    await labelRequest(`${API_BASE}/emails/bulk-labels`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailIds, labelId, action })
    });
    await fetchEmails(activeFolder);
  }

  function renderEmailLabelOptions() {
    if (!emailLabelOptions) return;
    if (!customLabels.length) {
      emailLabelOptions.innerHTML = '<span class="label-feedback">Create a label in the sidebar first.</span>';
      return;
    }
    const emailLabelIds = new Set((currentOpenEmail?.labels || []).map(id => String(id)));
    emailLabelOptions.innerHTML = customLabels.map(label => `
      <label class="email-label-option">
        <input type="checkbox" data-email-label="${label._id}" ${emailLabelIds.has(label._id) ? 'checked' : ''}>
        <span>${escapeHtml(label.name)}</span>
      </label>
    `).join('');
  }

  function renderEmailLabelChips(email) {
    const ids = new Set((email.labels || []).map(id => String(id)));
    emailLabelChips.innerHTML = customLabels
      .filter(label => ids.has(label._id))
      .map(label => `<span class="custom-label-chip">${escapeHtml(label.name)}</span>`)
      .join('');
  }

  createLabelButton.addEventListener('click', async () => {
    const name = prompt('Enter a name for the new label:');
    if (name === null) return;
    try {
      await labelRequest(`${API_BASE}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      setLabelFeedback('Label created.');
      await loadLabels();
    } catch (err) {
      setLabelFeedback(err.message, true);
    }
  });

  customLabelList.addEventListener('click', async event => {
    const selectButton = event.target.closest('[data-select-label]');
    const renameButton = event.target.closest('[data-rename-label]');
    const deleteButton = event.target.closest('[data-delete-label]');

    if (selectButton) {
      activeLabelId = selectButton.dataset.selectLabel;
      activeFolder = 'all';
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.toggle('active', nav.dataset.folder === 'all'));
      renderLabelSidebar();
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      closeDetailsModal();
      fetchEmails(activeFolder);
      sidebar.classList.remove('open');
      return;
    }

    const labelId = renameButton?.dataset.renameLabel || deleteButton?.dataset.deleteLabel;
    const label = customLabels.find(item => item._id === labelId);
    if (!label) return;

    if (renameButton) {
      const name = prompt('Rename this label:', label.name);
      if (name === null) return;
      try {
        await labelRequest(`${API_BASE}/labels/${labelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        setLabelFeedback('Label renamed.');
        await loadLabels();
        loadLabels().then(() => fetchEmails(activeFolder));
      } catch (err) {
        setLabelFeedback(err.message, true);
      }
      return;
    }

    if (deleteButton && confirm(`Delete the "${label.name}" label? Emails will not be deleted.`)) {
      try {
        await labelRequest(`${API_BASE}/labels/${labelId}`, { method: 'DELETE' });
        if (activeLabelId === labelId) {
          activeLabelId = null;
          activeFolder = 'inbox';
          document.querySelectorAll('.nav-item').forEach(nav => nav.classList.toggle('active', nav.dataset.folder === 'inbox'));
        }
        setLabelFeedback('Label deleted.');
        await loadLabels();
        fetchEmails(activeFolder);
      } catch (err) {
        setLabelFeedback(err.message, true);
      }
    }
  });

  emailLabelOptions.addEventListener('change', async event => {
    const checkbox = event.target.closest('[data-email-label]');
    if (!checkbox || !currentOpenEmail) return;
    const labelId = checkbox.dataset.emailLabel;
    const action = checkbox.checked ? 'apply' : 'remove';
    checkbox.disabled = true;
    try {
      await changeEmailLabels([currentOpenEmail._id], labelId, action);
      const labels = new Set((currentOpenEmail.labels || []).map(id => String(id)));
      if (action === 'apply') labels.add(labelId);
      else labels.delete(labelId);
      currentOpenEmail.labels = [...labels];
      renderEmailLabelChips(currentOpenEmail);
      setLabelFeedback(`Label ${action === 'apply' ? 'applied' : 'removed'}.`);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      setLabelFeedback(err.message, true);
    } finally {
      checkbox.disabled = false;
    }
  });

  bulkLabelSelect.addEventListener('change', () => {
    const disabled = !bulkLabelSelect.value || selectedEmailIds.size === 0;
    bulkLabelApply.disabled = disabled;
    bulkLabelRemove.disabled = disabled;
  });

  bulkLabelApply.addEventListener('click', async () => {
    if (!bulkLabelSelect.value || !selectedEmailIds.size) return;
    try {
      await changeEmailLabels([...selectedEmailIds], bulkLabelSelect.value, 'apply');
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      setLabelFeedback('Label applied to selected messages.');
    } catch (err) {
      setLabelFeedback(err.message, true);
    }
  });

  bulkLabelRemove.addEventListener('click', async () => {
    if (!bulkLabelSelect.value || !selectedEmailIds.size) return;
    try {
      await changeEmailLabels([...selectedEmailIds], bulkLabelSelect.value, 'remove');
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      setLabelFeedback('Label removed from selected messages.');
    } catch (err) {
      setLabelFeedback(err.message, true);
    }
  });

  // Fetch emails from server based on folder and search query
  async function fetchEmails(folder) {
    // If My Actions folder selected, show dedicated Action Engine dashboard
    if (folder === 'actions') {
      mailListWrapper.style.display = 'none';
      emptyStateView.style.display = 'none';
      actionsPanelView.style.display = 'flex';
      mailCountRange.textContent = 'Tasks';
      selectAllCheckbox.disabled = true;
      deleteActionBarBtn.disabled = true;
      restoreActionBarBtn.style.display = 'none';
      folderBanner.style.display = 'none';
      fetchUserTasks();
      refreshActionsBadge();
      return;
    }

    // Normal email folder handling
    actionsPanelView.style.display = 'none';
    selectAllCheckbox.disabled = false;

    const requestSequence = ++emailFetchSequence;
    try {
      const params = new URLSearchParams({ email: userEmail, folder });
      if (activeSearchQuery) params.set('q', activeSearchQuery);
      if (activeLabelId) params.set('labelId', activeLabelId);
      const response = await fetch(`${API_BASE}/emails?${params}`, {
        headers: activeLabelId ? tokenHeaders() : {}
      });
      if (!response.ok) {
        throw new Error('Failed to retrieve emails');
      }
      const data = await response.json();
      if (requestSequence !== emailFetchSequence) return;
      emailListCache = data;
      renderEmailList(data);
      if (folder !== 'drafts') refreshDraftBadge();
      refreshSpamBadge();
      refreshActionsBadge();
    } catch (err) {
      console.error('Error fetching emails:', err);
    }
  }

  // Update Status Flags (isStarred, isRead, isTrash) via PATCH request
  async function updateEmailStatus(id, updateFields) {
    try {
      const response = await fetch(`${API_BASE}/emails/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateFields)
      });
      return await response.json();
    } catch (err) {
      console.error('Error updating email status:', err);
    }
  }

  // Delete Permanently from Bin via DELETE request
  async function deleteEmailPermanently(id) {
    try {
      await fetch(`${API_BASE}/emails/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting email permanently:', err);
    }
  }

  // Restore email from Bin back to normal folder
  async function restoreEmail(id) {
    return updateEmailStatus(id, { isTrash: false });
  }

  // ==========================================
  // TOAST / SNACKBAR NOTIFICATION WITH UNDO
  // ==========================================
  const toastSnackbar = document.getElementById('toast-snackbar');
  const toastMessage = document.getElementById('toast-message');
  const toastActionBtn = document.getElementById('toast-action-btn');
  const toastCloseBtn = document.getElementById('toast-close-btn');
  let toastTimer = null;
  let activeUndoHandler = null;

  function showToast({ message, actionText = 'Undo', onAction = null, duration = 8000 }) {
    if (!toastSnackbar) return;
    if (toastTimer) clearTimeout(toastTimer);

    if (toastMessage) toastMessage.textContent = message;

    if (onAction && typeof onAction === 'function') {
      if (toastActionBtn) {
        toastActionBtn.textContent = actionText;
        toastActionBtn.style.display = 'inline-block';
      }
      activeUndoHandler = onAction;
    } else {
      if (toastActionBtn) toastActionBtn.style.display = 'none';
      activeUndoHandler = null;
    }

    toastSnackbar.style.display = 'flex';

    if (duration > 0) {
      toastTimer = setTimeout(() => {
        hideToast();
      }, duration);
    }
  }

  function hideToast() {
    if (!toastSnackbar) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastSnackbar.style.display = 'none';
    activeUndoHandler = null;
  }

  if (toastActionBtn) {
    toastActionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (activeUndoHandler) {
        const handler = activeUndoHandler;
        hideToast();
        await handler();
      }
    });
  }

  if (toastCloseBtn) {
    toastCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideToast();
    });
  }

  // Move email(s) to Bin with an Undo toast (Gmail style)
  async function moveEmailsToBin(emailIds, customMessage = null) {
    const ids = Array.isArray(emailIds) ? emailIds : [emailIds];
    if (ids.length === 0) return;

    for (const id of ids) {
      await updateEmailStatus(id, { isTrash: true });
    }
    fetchEmails(activeFolder);

    const message = customMessage || (ids.length > 1
      ? `${ids.length} conversations moved to Bin.`
      : 'Conversation moved to Bin.');

    showToast({
      message,
      actionText: 'Undo',
      duration: 8000,
      onAction: async () => {
        for (const id of ids) {
          await updateEmailStatus(id, { isTrash: false });
        }
        fetchEmails(activeFolder);
        if (emailDetailsModal && emailDetailsModal.style.display === 'flex' && currentOpenEmail) {
          await loadAndRenderThread(currentOpenEmail);
        }
        showToast({ message: 'Action undone.', duration: 4000 });
      }
    });
  }

  // Bin and Spam both delete forever (every other folder moves to Bin)
  function isPermanentDeleteFolder() {
    return activeFolder === 'bin' || activeFolder === 'spam' || Boolean(currentOpenEmail && (currentOpenEmail.isTrash || currentOpenEmail.isSpam));
  }

  // Report spam / Not spam endpoints need the signed-in user (x-user-email header)
  async function patchEmailAction(id, action) {
    try {
      const response = await fetch(`${API_BASE}/emails/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: '{}'
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, data };
    } catch (err) {
      console.error(`Error calling ${action}:`, err);
      return { ok: false, data: {} };
    }
  }

  function reportSpam(id) {
    return patchEmailAction(id, 'report-spam');
  }

  function markNotSpam(id) {
    return patchEmailAction(id, 'not-spam');
  }

  function markUnread(id) {
    return patchEmailAction(id, 'unread');
  }

  function markRead(id) {
    return patchEmailAction(id, 'read');
  }

  async function markEmailsRead(ids) {
    if (!ids || ids.length === 0) return;
    const targetIds = Array.isArray(ids) ? ids : [ids];

    // Optimistically update memory and DOM
    targetIds.forEach(id => {
      const row = emailListUl.querySelector(`li[data-id="${id}"]`);
      if (row) {
        row.classList.remove('unread');
        row.classList.add('read');
      }
      if (Array.isArray(emailListCache)) {
        emailListCache.forEach(cached => {
          if (cached._id === id || (cached.threadEmailIds && cached.threadEmailIds.includes(id))) {
            cached.isRead = true;
          }
        });
      }
    });

    await Promise.all(targetIds.map(id => updateEmailStatus(id, { isRead: true })));
    await Promise.all([
      fetchEmails(activeFolder),
      refreshInboxBadge(),
      refreshSpamBadge()
    ]);
  }

  async function markEmailsUnread(ids) {
    if (!ids || ids.length === 0) return;
    const targetIds = Array.isArray(ids) ? ids : [ids];

    // Optimistically update memory and DOM
    targetIds.forEach(id => {
      const row = emailListUl.querySelector(`li[data-id="${id}"]`);
      if (row) {
        row.classList.remove('read');
        row.classList.add('unread');
      }
      if (Array.isArray(emailListCache)) {
        emailListCache.forEach(cached => {
          if (cached._id === id || (cached.threadEmailIds && cached.threadEmailIds.includes(id))) {
            cached.isRead = false;
          }
        });
      }
    });

    await Promise.all(targetIds.map(id => updateEmailStatus(id, { isRead: false })));
    await Promise.all([
      fetchEmails(activeFolder),
      refreshInboxBadge(),
      refreshSpamBadge()
    ]);
  }

  // Folders where "Report spam" is available (Bin included: reporting moves the mail out of Bin into Spam)
  const REPORT_SPAM_FOLDERS = ['inbox', 'starred', 'all', 'bin'];
  const UNREAD_ACTION_FOLDERS = ['inbox', 'starred', 'sent', 'all'];

  function canToggleReadStatus(email) {
    return Boolean(email)
      && !email.isDraft
      && !email.isTrash
      && !email.isSpam
      && (UNREAD_ACTION_FOLDERS.includes(activeFolder) || Boolean(activeLabelId));
  }

  function canMarkUnread(email) {
    return canToggleReadStatus(email);
  }

  // Only mail received from someone else can be reported, and only from the folders above
  function canReportSpam(email) {
    return Boolean(email)
      && !email.isDraft
      && !email.isSpam
      && email.sender !== userEmail
      && REPORT_SPAM_FOLDERS.includes(activeFolder);
  }

  // Sidebar Spam badge = number of unread messages in Spam
  async function refreshSpamBadge() {
    try {
      const response = await fetch(`${API_BASE}/emails/counts`, {
        headers: { 'x-user-email': userEmail }
      });
      if (!response.ok) return;
      const { spamUnread } = await response.json();
      const badgeSpam = document.getElementById('badge-spam');
      if (badgeSpam) badgeSpam.textContent = spamUnread > 0 ? spamUnread : '';
    } catch (err) {
      console.error('Error refreshing spam badge:', err);
    }
  }

  // Permanently deletes everything in Bin or Spam (the "Empty Bin now" button)
  async function emptyFolderNow(folder) {
    const response = await fetch(`${API_BASE}/emails/folder/${folder}/empty`, {
      method: 'DELETE',
      headers: { 'x-user-email': userEmail }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to empty folder');
    }
    return response.json();
  }

  // ==========================================
  // 5. EMAIL LIST RENDERING
  // ==========================================

  // Shows the 30-day auto-delete notice above the Bin and Spam lists
  function updateFolderBanner(emailCount) {
    const notice = FOLDER_NOTICES[activeFolder];
    if (!notice || activeSearchQuery) {
      folderBanner.style.display = 'none';
      return;
    }
    folderBannerText.textContent = notice.text;
    folderBannerBtn.textContent = notice.button;
    folderBannerBtn.style.display = emailCount > 0 ? '' : 'none'; // nothing to empty
    folderBanner.style.display = 'flex';
  }

  // Group individual emails into conversation threads (Gmail-style conversation view)
  function groupEmailsByThread(emails) {
    if (activeFolder === 'drafts') return emails;

    const threadsMap = new Map();
    const threadOrder = [];

    emails.forEach(email => {
      const rawSubj = (email.subject || '').trim();
      const cleanSubj = rawSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim().toLowerCase();
      const isNoSubject = !cleanSubj || cleanSubj === '(no subject)' || cleanSubj === 'no subject';
      // Use threadId if present, else fallback to clean subject for legacy emails (never group No Subject)
      const threadKey = email.threadId
        ? String(email.threadId)
        : (!isNoSubject ? `subj_${cleanSubj}` : String(email._id));

      if (!threadsMap.has(threadKey)) {
        threadsMap.set(threadKey, []);
        threadOrder.push(threadKey);
      }
      threadsMap.get(threadKey).push(email);
    });

    return threadOrder.map(threadKey => {
      const rawThreadList = threadsMap.get(threadKey);
      // Sort chronological: oldest to newest
      rawThreadList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Filter out duplicate identical self-sent copies
      const seenSig = new Set();
      const threadList = [];
      for (const e of rawThreadList) {
        const timeMs = new Date(e.timestamp).getTime();
        const roundedTime = Math.floor(timeMs / 3000);
        const sig = `${e.sender}|${e.subject}|${e.body}|${roundedTime}`;
        if (!seenSig.has(sig)) {
          seenSig.add(sig);
          threadList.push(e);
        }
      }

      // Latest message in thread represents the thread entry in the list
      const latest = threadList[threadList.length - 1];
      const hasUnread = threadList.some(e => !e.isRead && !e.isDraft);
      const hasStarred = threadList.some(e => e.isStarred);

      // Collect sender/recipient names across conversation
      let displaySenderHtml = '';
      if (activeFolder === 'sent') {
        const recipNames = [];
        threadList.forEach(e => {
          const names = Array.isArray(e.receiverFirstNames) && e.receiverFirstNames.length > 0
            ? e.receiverFirstNames
            : (e.receiverFirstName ? [e.receiverFirstName] : (e.receiverName ? [e.receiverName.split(' ')[0]] : (e.receiver ? e.receiver.split(',').map(r => r.trim().split('@')[0]) : [])));
          names.forEach(name => {
            const clean = name.trim();
            if (clean && !recipNames.includes(clean)) {
              recipNames.push(clean);
            }
          });
        });
        const recipsText = recipNames.length > 0 ? recipNames.join(', ') : 'recipient';
        displaySenderHtml = `To: ${escapeHtml(recipsText)}`;
      } else {
        const participantNames = [];
        threadList.forEach(e => {
          const isMe = e.sender && e.sender.toLowerCase() === userEmail.toLowerCase();
          const name = isMe
            ? 'me'
            : (e.senderName || e.firstName || (e.sender ? e.sender.split('@')[0] : 'Unknown'));
          if (!participantNames.includes(name)) {
            participantNames.push(name);
          }
        });
        displaySenderHtml = escapeHtml(participantNames.join(', '));
      }

      if (threadList.length > 1) {
        displaySenderHtml += ` <span class="email-thread-count">${threadList.length}</span>`;
      }

      // Clean subject
      const origSubj = latest.subject === '(No Subject)' ? '' : (latest.subject || '');
      const cleanSubject = origSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim() || origSubj || '(No Subject)';

      // Clean snippet: exclude quoted replies and header lines
      const bodyLines = (latest.body || '').split('\n');
      const cleanLines = [];
      for (const rawLine of bodyLines) {
        const line = rawLine.trim();
        if (/^on .+ wrote:$/i.test(line)) break;
        if (/^-+\s*original message\s*-+/i.test(line)) break;
        if (/^-+\s*forwarded message\s*-+/i.test(line)) break;
        if (line.startsWith('>')) continue;
        if (line) cleanLines.push(line);
      }
      const cleanSnippet = cleanLines.join(' ').replace(/\s+/g, ' ').trim() || latest.body || '';

      return {
        ...latest,
        labels: [...new Set(threadList.flatMap(message => (message.labels || []).map(id => String(id))))],
        displaySenderHtml,
        displaySubject: cleanSubject,
        displaySnippet: cleanSnippet.slice(0, 100),
        isRead: !hasUnread,
        isStarred: hasStarred,
        threadCount: threadList.length,
        threadEmailIds: threadList.map(e => e._id),
        threadEmails: threadList
      };
    });
  }

  function renderEmailList(rawEmails) {
    emailListUl.innerHTML = '';

    // Group into conversation threads (Gmail-style)
    const emails = groupEmailsByThread(rawEmails);

    // Update Badge counts for Inbox and Drafts
    if (!activeSearchQuery) updateFolderBadges(rawEmails);
    updateFolderBanner(emails.length);

    if (emails.length === 0) {
      showEmptyState(activeFolder, Boolean(activeSearchQuery));
      mailCountRange.textContent = '0-0 of 0';
      return;
    }

    emptyStateView.style.display = 'none';
    mailListWrapper.style.display = 'block';
    mailCountRange.textContent = `1-${emails.length} of ${emails.length}`;

    emails.forEach(email => {
      const li = document.createElement('li');
      li.className = `email-row ${email.isRead || email.isDraft ? 'read' : 'unread'}`;
      li.setAttribute('data-id', email._id);

      const formattedDate = formatTimestamp(email.timestamp);

      // Determine sender display: if user is sender, display receiver
      let displaySender;
      if (email.isDraft) {
        displaySender = '<span class="draft-label">Draft</span>';
      } else if (email.displaySenderHtml) {
        displaySender = email.displaySenderHtml;
      } else if (activeFolder === 'sent' || email.sender === userEmail) {
        const recipFirstName = email.receiverFirstName ||
          (Array.isArray(email.receiverFirstNames) && email.receiverFirstNames[0]) ||
          (email.receiverName ? email.receiverName.split(' ')[0] : '') ||
          (email.receiver ? email.receiver.split('@')[0] : '');
        displaySender = `To: ${escapeHtml(recipFirstName || 'recipient')}`;
      } else {
        displaySender = escapeHtml(email.firstName || email.sender.split('@')[0]);
      }

      // Star control (hidden when in Bin or Spam)
      const starClass = email.isStarred ? 'starred' : '';
      const starControl = (activeFolder === 'bin' || activeFolder === 'spam')
        ? ''
        : `<img src="images/star-regular-full.svg" alt="Star" role="button" tabindex="0" aria-label="${email.isStarred ? 'Unstar email' : 'Star email'}" class="email-row-star ${starClass}" data-id="${email._id}">`;

      // Row hover action buttons:
      //   Bin  -> Report spam (received mail) + Restore + Delete forever
      //   Spam -> Not spam + Delete forever
      //   Else -> Report spam (received mail only) + Move to Bin
      let rowActions;
      if (activeFolder === 'bin') {
        const binReportBtn = canReportSpam(email)
          ? `<button class="action-icon-btn btn-row-spam" data-id="${email._id}" title="Report spam">${SPAM_ICON_SVG}</button>`
          : '';
        rowActions = `
          ${binReportBtn}
          <button class="action-icon-btn btn-row-restore" data-id="${email._id}" title="Restore">
            <span class="restore-icon" aria-hidden="true">&#8630;</span>
          </button>
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Permanently delete">
            <img src="images/trash-can-regular-full.svg" alt="Delete permanently" class="row-action-icon-img">
          </button>
        `;
      } else if (activeFolder === 'spam') {
        rowActions = `
          <button class="btn-text-action btn-row-notspam" data-id="${email._id}" title="Not spam">Not spam</button>
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Delete forever">
            <img src="images/trash-can-regular-full.svg" alt="Delete forever" class="row-action-icon-img">
          </button>
        `;
      } else {
        let readToggleBtn = '';
        if (canToggleReadStatus(email)) {
          if (email.isRead) {
            readToggleBtn = `
              <button class="action-icon-btn btn-row-unread" data-id="${email._id}" title="Mark as unread" aria-label="Mark as unread">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
                </svg>
              </button>
            `;
          } else {
            readToggleBtn = `
              <button class="action-icon-btn btn-row-read" data-id="${email._id}" title="Mark as read" aria-label="Mark as read">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 3.32L19.99 8v.01L12 13 4 8.01V8l8-4.68zM4 18v-8.08l7.46 4.66c.16.1.35.15.54.15s.38-.05.54-.15L20 9.92V18H4z"/>
                </svg>
              </button>
            `;
          }
        }
        const reportBtn = canReportSpam(email)
          ? `<button class="action-icon-btn btn-row-spam" data-id="${email._id}" title="Report spam">${SPAM_ICON_SVG}</button>`
          : '';
        rowActions = `
          ${readToggleBtn}
          ${reportBtn}
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Move to Bin">
            <img src="images/trash-can-regular-full.svg" alt="Move to Bin" class="row-action-icon-img">
          </button>
        `;
      }

      // "12 days left" hint (Bin & Spam only - the backend sends daysLeft)
      const expiryHtml = email.daysLeft !== undefined
        ? `<span class="email-expiry ${email.daysLeft <= 3 ? 'soon' : ''}">${email.daysLeft} day${email.daysLeft !== 1 ? 's' : ''} left</span>`
        : '';

      li.innerHTML = `
        <input type="checkbox" class="email-row-select" data-id="${email._id}" aria-label="Select mail">
        ${starControl}
        <div class="email-sender">${displaySender}</div>
        <div class="email-content">
          <span class="email-subject">${escapeHtml(email.displaySubject || email.subject)}</span>
          <span class="email-snippet">— ${escapeHtml(email.displaySnippet !== undefined ? email.displaySnippet : email.body.substring(0, 80))}</span>
          <span class="email-row-labels">${customLabels
            .filter(label => (email.labels || []).some(id => String(id) === label._id))
            .map(label => `<span class="custom-label-chip">${escapeHtml(label.name)}</span>`).join('')}</span>
          ${expiryHtml}
        </div>
        <div class="email-date">${formattedDate}</div>
        <div class="email-row-actions">${rowActions}</div>
      `;

      // Star toggle click event
      const star = li.querySelector('.email-row-star');
      if (star) {
        const toggleStar = async (event) => {
          event.stopPropagation();

          if (event.type === 'keydown') {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
          }

          const previousState = email.isStarred;
          const nextState = !previousState;
          email.isStarred = nextState;
          star.classList.toggle('starred', nextState);
          star.setAttribute('aria-label', nextState ? 'Unstar email' : 'Star email');

          const targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
            ? email.threadEmailIds
            : [email._id];

          for (const id of targetIds) {
            await updateEmailStatus(id, { isStarred: nextState });
          }
          fetchEmails(activeFolder);
        };

        star.addEventListener('click', toggleStar);
        star.addEventListener('keydown', toggleStar);
      }

      // Checkbox select event
      const cb = li.querySelector('.email-row-select');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        let targetIds;
        if (activeFolder === 'sent') {
          const sentEmails = (email.threadEmails || []).filter(m => (m.sender || '').toLowerCase() === userEmail.toLowerCase());
          targetIds = sentEmails.length > 0 ? sentEmails.map(m => m._id) : [cb.getAttribute('data-id')];
        } else {
          targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
            ? email.threadEmailIds
            : [cb.getAttribute('data-id')];
        }

        if (cb.checked) {
          targetIds.forEach(id => selectedEmailIds.add(String(id)));
        } else {
          targetIds.forEach(id => selectedEmailIds.delete(String(id)));
        }
        updateDeleteButtonState();
      });

      // Hover row Delete event
      const deleteBtn = li.querySelector('.btn-row-delete');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        let targetIds;
        if (activeFolder === 'sent') {
          const sentEmails = (email.threadEmails || []).filter(m => (m.sender || '').toLowerCase() === userEmail.toLowerCase());
          targetIds = sentEmails.length > 0 ? sentEmails.map(m => m._id) : [deleteBtn.getAttribute('data-id')];
        } else {
          targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
            ? email.threadEmailIds
            : [deleteBtn.getAttribute('data-id')];
        }

        if (isPermanentDeleteFolder()) {
          if (confirm('Permanently delete this email?')) {
            for (const id of targetIds) {
              await deleteEmailPermanently(id);
            }
            fetchEmails(activeFolder);
          }
        } else {
          await moveEmailsToBin(targetIds);
        }
      });

      // Hover row Restore event (in Bin only)
      const restoreBtn = li.querySelector('.btn-row-restore');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await restoreEmail(restoreBtn.getAttribute('data-id'));
          fetchEmails(activeFolder);
        });
      }

      // Hover row Report spam event (Inbox / Starred / All Mail / Bin)
      const spamBtn = li.querySelector('.btn-row-spam');
      if (spamBtn) {
        spamBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { ok } = await reportSpam(email._id);
          if (!ok) alert('Could not report this message as spam. Please try again.');
          fetchEmails(activeFolder);
        });
      }

      // Hover row Not spam event (Spam only)
      const notSpamBtn = li.querySelector('.btn-row-notspam');
      if (notSpamBtn) {
        notSpamBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const { ok } = await markNotSpam(email._id);
          if (!ok) alert('Could not move this message to the Inbox. Please try again.');
          fetchEmails(activeFolder);
        });
      }

      const readBtn = li.querySelector('.btn-row-read');
      if (readBtn) {
        readBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
            ? email.threadEmailIds
            : [email._id];
          await markEmailsRead(targetIds);
        });
      }

      const unreadBtn = li.querySelector('.btn-row-unread');
      if (unreadBtn) {
        unreadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
            ? email.threadEmailIds
            : [email._id];
          await markEmailsUnread(targetIds);
        });
      }

      // Open email details or draft in compose on row click
      li.addEventListener('click', () => {
        if (activeFolder === 'drafts' && email.isDraft) {
          openDraftInCompose(email);
        } else {
          openEmailDetails(email);
        }
      });

      emailListUl.appendChild(li);
    });
  }

  // ==========================================
  // 6. EMAIL DETAILS OVERLAY VIEW
  // ==========================================

  // Open Details panel overlay
  async function openEmailDetails(email) {
    currentOpenEmail = email;
    emailLabelPicker.open = false;
    renderEmailLabelChips(email);
    renderEmailLabelOptions();
    emailDetailsModal.style.display = 'flex';
    emailInfoPanel.hidden = true;
    emailInfoToggle.setAttribute('aria-expanded', 'false');
    const inBin = activeFolder === 'bin' || Boolean(email.isTrash);
    const inSpam = activeFolder === 'spam' || Boolean(email.isSpam);
    const canToggleRead = canToggleReadStatus(email);
    if (detailsActionUnread) {
      detailsActionUnread.style.display = canToggleRead ? 'inline-flex' : 'none';
    }
    detailsActionRestore.style.display = inBin ? 'inline-flex' : 'none';
    detailsActionDelete.title = inBin ? 'Permanently delete' : inSpam ? 'Delete forever' : 'Move to Bin';
    detailsStarButton.style.display = (inBin || inSpam) ? 'none' : 'inline-flex';

    // Show/hide Reply & Forward buttons (disabled in Bin, Spam, or Drafts)
    const canReplyOrForward = !inBin && !inSpam && !email.isDraft;
    if (replyForwardBar) {
      replyForwardBar.style.display = canReplyOrForward ? 'flex' : 'none';
    }
    if (btnHeaderReply) {
      btnHeaderReply.style.display = canReplyOrForward ? 'inline-flex' : 'none';
    }

    // Report spam (received mail in Inbox/Starred/All/Bin) or Not spam (inside Spam)
    detailsActionSpam.style.display = canReportSpam(email) ? 'flex' : 'none';
    detailsActionNotSpam.style.display = inSpam ? 'inline-block' : 'none';

    // Explain why the message was flagged (user-friendly, non-technical explanation)
    if (inSpam) {
      let rawReasons = Array.isArray(email.spamReasons) && email.spamReasons.length > 0
        ? email.spamReasons
        : ['It is similar to messages that were identified as spam.'];

      const friendlyReasons = rawReasons.map(r => {
        if (/reported|blocked|preference/i.test(r)) {
          return 'You previously reported messages from this sender as spam.';
        }
        return 'It is similar to messages that were identified as spam.';
      });
      const uniqueReasons = [...new Set(friendlyReasons)];
      spamWarningReasons.textContent = uniqueReasons.join(' • ');
      spamWarning.style.display = 'block';
    } else {
      spamWarning.style.display = 'none';
    }

    // Configure Extract Actions button state
    if (btnExtractActions) {
      btnExtractActions.style.display = (inBin || inSpam || email.isDraft) ? 'none' : 'inline-flex';
      btnExtractActions.disabled = false;
      btnExtractSpinner.style.display = 'none';
      btnExtractText.textContent = 'Extract Actions';
    }
    if (emailTasksSection) {
      emailTasksSection.style.display = 'none';
      emailTasksList.innerHTML = '';
    }

    // Set Subject
    const origSubject = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubject = origSubject.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();
    if (detailsSubject) detailsSubject.textContent = cleanSubject || origSubject || '(No Subject)';

    setDetailsStarState(email.isStarred);

    // Populate main message view immediately with clicked email
    populateMainEmailView(email);

    // Automatically mark all messages in this email/thread as read
    const targetIds = (email.threadEmailIds && email.threadEmailIds.length > 0)
      ? email.threadEmailIds
      : [email._id];

    email.isRead = true;
    if (Array.isArray(email.threadEmails)) {
      email.threadEmails.forEach(e => { e.isRead = true; });
    }
    if (Array.isArray(emailListCache)) {
      emailListCache.forEach(cached => {
        if (targetIds.includes(cached._id) || (cached.threadEmailIds && cached.threadEmailIds.some(tid => targetIds.includes(tid)))) {
          cached.isRead = true;
        }
      });
    }

    const clickedRow = emailListUl.querySelector(`li[data-id="${email._id}"]`);
    if (clickedRow) {
      clickedRow.classList.remove('unread');
      clickedRow.classList.add('read');
      const sideBtn = clickedRow.querySelector('.btn-row-read');
      if (sideBtn) {
        sideBtn.className = 'action-icon-btn btn-row-unread';
        sideBtn.title = 'Mark as unread';
        sideBtn.setAttribute('aria-label', 'Mark as unread');
        sideBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
          </svg>
        `;
      }
    }

    // Persist read state in database
    Promise.all(targetIds.map(id => updateEmailStatus(id, { isRead: true }))).then(() => {
      refreshInboxBadge();
    });

    // Load and render all messages in this conversation thread
    await loadAndRenderThread(email);

    // Load any existing extracted tasks for this email
    if (email._id && !email.isDraft && !inBin && !inSpam) {
      fetchEmailTasks(email._id);
    }
  }

  // Format date for Gmail quote header: "Mon, Oct 19, 2026 at 1:08 PM"
  function formatGmailQuoteDate(timestampStr) {
    const date = new Date(timestampStr);
    if (Number.isNaN(date.getTime())) return '';
    const weekday = date.toLocaleString('en-US', { weekday: 'short' });
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${weekday}, ${month} ${day}, ${year} at ${time}`;
  }

  // Format multiple recipients for display ("to Diya, me", and "Diya <diya@flow.com>, Elma <elma@flow.com>")
  function formatRecipientsDisplay(email) {
    const raw = email.receiver || '';
    if (!raw.trim()) {
      return {
        shortText: 'recipient unavailable',
        fullText: 'Recipient details unavailable'
      };
    }

    const addresses = raw.split(',').map(r => r.trim()).filter(Boolean);
    if (addresses.length === 0) {
      return {
        shortText: 'recipient unavailable',
        fullText: 'Recipient details unavailable'
      };
    }

    const shortNames = [];
    const fullEntries = [];

    addresses.forEach((addr, idx) => {
      const isMe = addr.toLowerCase() === userEmail.toLowerCase();
      const fallbackName = addr.split('@')[0];
      const displayName = (Array.isArray(email.receiverNamesList) && email.receiverNamesList[idx])
        ? email.receiverNamesList[idx]
        : (isMe ? (`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || fallbackName) : fallbackName);

      if (isMe) {
        shortNames.push('me');
        fullEntries.push(`${displayName || 'me'} <${addr}>`);
      } else {
        shortNames.push(displayName);
        fullEntries.push(`${displayName} <${addr}>`);
      }
    });

    return {
      shortText: `to ${shortNames.join(', ')}`,
      fullText: fullEntries.join(', ')
    };
  }

  // Renders email body with Gmail-style vertical line for quotes instead of '>' marks
  function renderFormattedEmailBody(rawBody, container) {
    if (!container) return;
    container.replaceChildren();

    if (!rawBody) return;

    const lines = rawBody.split('\n');
    const stack = [{ container, isQuote: false }];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Check if line is a quote header (e.g. "On Mon, Oct 19, 2026 ... wrote:")
      const cleanLineForCheck = line.replace(/^[>\s]+/, '').trim();
      const isQuoteHeader = /^on\s+.+\s+wrote:$/i.test(cleanLineForCheck);

      if (isQuoteHeader) {
        const current = stack[stack.length - 1].container;
        const headerDiv = document.createElement('div');
        headerDiv.className = 'gmail-quote-header';
        headerDiv.textContent = cleanLineForCheck;
        current.appendChild(headerDiv);

        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'gmail-quote';
        current.appendChild(quoteDiv);

        stack.push({ container: quoteDiv, isQuote: true });
        continue;
      }

      // Check if line starts with '>'
      const quoteMatch = line.match(/^>+/);
      const quoteLevel = quoteMatch ? quoteMatch[0].length : 0;
      if (quoteLevel > 0) {
        line = line.replace(/^>+\s?/, '');

        while (stack.filter(s => s.isQuote).length < quoteLevel) {
          const current = stack[stack.length - 1].container;
          const quoteDiv = document.createElement('div');
          quoteDiv.className = 'gmail-quote';
          current.appendChild(quoteDiv);
          stack.push({ container: quoteDiv, isQuote: true });
        }
      }

      const current = stack[stack.length - 1].container;
      const lineDiv = document.createElement('div');
      if (line === '') {
        lineDiv.innerHTML = '&nbsp;';
      } else {
        lineDiv.textContent = line;
      }
      current.appendChild(lineDiv);
    }
  }

  // Populate main email message elements in the details view
  function populateMainEmailView(email) {
    currentMainEmail = email;
    const senderName = email.senderName || email.firstName || (email.sender || '').split('@')[0] || 'Unknown sender';
    const recips = formatRecipientsDisplay(email);

    if (detailsSenderAvatar) {
      detailsSenderAvatar.textContent = senderName[0].toUpperCase();
      detailsSenderAvatar.style.backgroundColor = getAvatarColor(email.sender || senderName);
    }
    if (detailsSenderName) detailsSenderName.textContent = senderName;
    if (detailsSenderEmail) detailsSenderEmail.textContent = email.sender ? `<${email.sender}>` : '';
    if (detailsReceiverEmail) detailsReceiverEmail.textContent = recips.shortText;
    if (detailsTimestamp) detailsTimestamp.textContent = formatDetailedTimestamp(email.timestamp);
    if (detailsContent) renderFormattedEmailBody(email.body, detailsContent);

    if (emailInfoFrom) emailInfoFrom.textContent = email.sender ? `${senderName} <${email.sender}>` : 'Sender details unavailable';
    if (emailInfoTo) emailInfoTo.textContent = recips.fullText;
    if (emailInfoDate) emailInfoDate.textContent = formatFullTimestamp(email.timestamp);
    if (emailInfoSubject) emailInfoSubject.textContent = email.subject || '(No Subject)';

    // Header action buttons for the main email
    const inBin = activeFolder === 'bin' || Boolean(email.isTrash);
    const inSpam = activeFolder === 'spam' || Boolean(email.isSpam);
    const canReplyOrForward = !inBin && !inSpam && !email.isDraft;

    if (btnHeaderStar) {
      btnHeaderStar.classList.toggle('starred', Boolean(email.isStarred));
      btnHeaderStar.title = email.isStarred ? 'Unstar message' : 'Star message';
      btnHeaderStar.style.display = (inBin || inSpam) ? 'none' : 'inline-flex';
    }
    if (btnHeaderReply) {
      btnHeaderReply.style.display = canReplyOrForward ? 'inline-flex' : 'none';
    }
    if (btnHeaderForward) {
      btnHeaderForward.style.display = canReplyOrForward ? 'inline-flex' : 'none';
    }
    if (btnHeaderDelete) {
      btnHeaderDelete.title = inBin ? 'Permanently delete' : inSpam ? 'Delete forever' : 'Move to Bin';
      btnHeaderDelete.style.display = 'inline-flex';
    }

    renderEmailAttachments(email);
  }

  function setDetailsStarState(isStarred) {
    detailsStarIcon.classList.toggle('starred', isStarred);
    detailsStarButton.setAttribute('aria-pressed', String(isStarred));
    detailsStarButton.setAttribute('aria-label', isStarred ? 'Unstar email' : 'Star email');
    detailsStarButton.title = isStarred ? 'Unstar email' : 'Star email';

    if (btnHeaderStar) {
      btnHeaderStar.classList.toggle('starred', Boolean(isStarred));
      btnHeaderStar.title = isStarred ? 'Unstar message' : 'Star message';
    }
  }

  function closeDetailsModal() {
    emailDetailsModal.style.display = 'none';
    currentOpenEmail = null;
    currentMainEmail = null;
    currentThreadEmails = [];
    currentThreadActiveEmails = [];
    currentThreadDeletedEmails = [];
    currentConversationThreadId = null;
    if (threadDeletedBanner) threadDeletedBanner.style.display = 'none';
    if (threadDeletedMessages) {
      threadDeletedMessages.style.display = 'none';
      threadDeletedMessages.replaceChildren();
    }
    if (threadOlderMessages) {
      threadOlderMessages.style.display = 'none';
      threadOlderMessages.replaceChildren();
    }
    if (detailsSenderInfo) detailsSenderInfo.classList.remove('has-previous-messages');
    if (replyForwardBar) replyForwardBar.style.display = 'none';
    if (btnDetailReplyAll) btnDetailReplyAll.style.display = 'none';
    if (btnHeaderReply) btnHeaderReply.style.display = 'none';
    if (btnHeaderForward) btnHeaderForward.style.display = 'none';
    if (btnHeaderStar) btnHeaderStar.classList.remove('starred');
    if (emailInfoPanel) emailInfoPanel.hidden = true;
    if (emailInfoToggle) emailInfoToggle.setAttribute('aria-expanded', 'false');
    attachmentRenderSequence += 1;
    attachmentObjectUrls.forEach(url => URL.revokeObjectURL(url));
    attachmentObjectUrls = [];
    if (emailAttachmentsList) emailAttachmentsList.replaceChildren();
    if (emailAttachmentsSection) emailAttachmentsSection.hidden = true;
    if (spamWarning) spamWarning.style.display = 'none';
    if (emailTasksSection) {
      emailTasksSection.style.display = 'none';
      if (emailTasksList) emailTasksList.innerHTML = '';
    }
    if (btnExtractActions) {
      btnExtractActions.disabled = false;
      if (btnExtractSpinner) btnExtractSpinner.style.display = 'none';
      if (btnExtractText) btnExtractText.textContent = 'Extract Actions';
    }
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatFullTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function clearAttachmentPreviews() {
    attachmentRenderSequence += 1;
    attachmentObjectUrls.forEach(url => URL.revokeObjectURL(url));
    attachmentObjectUrls = [];
  }

  function createAttachmentCard(email, attachment) {
    const card = document.createElement('article');
    card.className = 'email-attachment-card';
    card.title = `Click to download ${attachment.filename || 'attachment'}`;
    const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mimeType);

    if (isImage) {
      const preview = document.createElement('img');
      preview.className = 'email-attachment-preview';
      preview.alt = `Preview of ${attachment.filename || 'image attachment'}`;
      preview.src = '';
      card.appendChild(preview);

      fetch(`${API_BASE}/emails/${email._id}/attachments/${attachment._id}/preview`, {
        headers: tokenHeaders()
      })
      .then(res => {
        if (!res.ok) throw new Error('Image preview is unavailable');
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        attachmentObjectUrls.push(objectUrl);
        preview.src = objectUrl;
      })
      .catch(() => {
        const unavailable = document.createElement('span');
        unavailable.className = 'attachment-preview-unavailable';
        unavailable.textContent = 'IMG';
        preview.replaceWith(unavailable);
      });
    } else {
      const icon = document.createElement('span');
      icon.className = 'attachment-file-icon';
      icon.setAttribute('aria-hidden', 'true');
      const ext = (attachment.filename && attachment.filename.includes('.'))
        ? attachment.filename.split('.').pop().toUpperCase()
        : (attachment.mimeType ? attachment.mimeType.split('/').pop().toUpperCase() : 'FILE');
      icon.textContent = ext.slice(0, 4);
      card.appendChild(icon);
    }

    const metadata = document.createElement('div');
    metadata.className = 'email-attachment-metadata';

    const filename = document.createElement('div');
    filename.className = 'email-attachment-name';
    filename.textContent = attachment.filename || 'Unnamed attachment';
    filename.title = attachment.filename || '';

    const fileSize = document.createElement('div');
    fileSize.className = 'email-attachment-type';
    fileSize.textContent = `${attachment.mimeType || 'File'} · ${formatFileSize(attachment.size)}`;

    metadata.append(filename, fileSize);
    card.appendChild(metadata);

    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'attachment-download-button';
    downloadButton.title = 'Download file';
    downloadButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      <span>Download</span>
    `;
    downloadButton.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadAttachment(email, attachment, downloadButton);
    });
    card.appendChild(downloadButton);

    // Clicking anywhere on the card directly downloads the file
    card.addEventListener('click', () => {
      downloadAttachment(email, attachment, downloadButton);
    });

    return card;
  }

  function renderEmailAttachments(email) {
    clearAttachmentPreviews();
    emailAttachmentsList.replaceChildren();
    const attachments = Array.isArray(email.attachments) ? email.attachments : [];
    emailAttachmentsSection.hidden = attachments.length === 0;
    if (attachments.length === 0) return;

    attachments.forEach(attachment => {
      const card = createAttachmentCard(email, attachment);
      emailAttachmentsList.appendChild(card);
    });
  }

  async function downloadAttachment(email, attachment, btn) {
    const originalContent = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="action-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:4px;"></span> Downloading...';
    }

    try {
      const response = await fetch(
        `${API_BASE}/emails/${email._id}/attachments/${attachment._id}/download`,
        { headers: tokenHeaders() }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'The attachment could not be downloaded.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error('Attachment download failed:', err);
      alert(err.message);
    } finally {
      if (btn && originalContent !== null) {
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
    }
  }

  // ==========================================
  // 6.5. EMAIL-TO-ACTION ENGINE LOGIC
  // ==========================================

  // Format deadline for task cards
  function formatTaskDeadline(deadlineStr) {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime())) return null;

    const now = new Date();
    const isOverdue = deadline < now;

    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    
    // Check if time is specified (not default midnight 00:00:00 UTC)
    const hasTime = deadline.getUTCHours() !== 0 || deadline.getUTCMinutes() !== 0;
    const dateFormatted = deadline.toLocaleDateString('en-US', dateOptions);
    const timeFormatted = hasTime ? `, ${deadline.toLocaleTimeString([], timeOptions)}` : '';

    return {
      text: `${dateFormatted}${timeFormatted}`,
      isOverdue
    };
  }

  // Show temporary feedback banner in actions panel
  function showActionBanner(type, message) {
    if (!actionsBanner) return;
    actionsBanner.className = `actions-banner ${type}`;
    actionsBanner.textContent = message;
    actionsBanner.style.display = 'flex';
    setTimeout(() => {
      actionsBanner.style.display = 'none';
    }, 4500);
  }

  // Update sidebar My Actions badge with count of Pending tasks
  async function refreshActionsBadge() {
    try {
      const response = await fetch(`${API_BASE}/tasks?userEmail=${encodeURIComponent(userEmail)}&status=Pending`, {
        headers: { 'x-user-email': userEmail }
      });
      if (!response.ok) return;
      const tasks = await response.json();
      if (badgeActions) {
        badgeActions.textContent = tasks.length > 0 ? tasks.length : '';
      }
    } catch (err) {
      console.error('Error refreshing actions badge:', err);
    }
  }

  // Fetch tasks associated with a specific email (for inline details view)
  async function fetchEmailTasks(emailId) {
    try {
      const response = await fetch(`${API_BASE}/tasks?userEmail=${encodeURIComponent(userEmail)}&emailId=${emailId}`, {
        headers: { 'x-user-email': userEmail }
      });
      if (!response.ok) return;
      const tasks = await response.json();
      emailTasksCache = tasks;

      if (tasks.length > 0) {
        emailTasksSection.style.display = 'block';
        emailTasksCount.textContent = `${tasks.length} item${tasks.length !== 1 ? 's' : ''}`;
        btnExtractText.textContent = 'Re-extract Actions';
        renderTaskCards(tasks, emailTasksList, true);
      } else {
        emailTasksSection.style.display = 'none';
        btnExtractText.textContent = 'Extract Actions';
      }
    } catch (err) {
      console.error('Error fetching email tasks:', err);
    }
  }

  // Extract Actions using Gemini AI
  async function extractActionsForCurrentEmail(forceRefresh = false) {
    if (!currentOpenEmail) return;

    btnExtractActions.disabled = true;
    btnExtractSpinner.style.display = 'inline-block';
    btnExtractText.textContent = forceRefresh ? 'Re-analyzing...' : 'Extracting...';

    try {
      const response = await fetch(`${API_BASE}/tasks/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({
          emailId: currentOpenEmail._id,
          userEmail,
          forceRefresh
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to extract tasks with AI');
      }

      const tasks = data.tasks || [];
      emailTasksCache = tasks;

      if (tasks.length > 0) {
        emailTasksSection.style.display = 'block';
        emailTasksCount.textContent = `${tasks.length} item${tasks.length !== 1 ? 's' : ''}`;
        renderTaskCards(tasks, emailTasksList, true);
        btnExtractText.textContent = 'Re-extract Actions';
      } else {
        emailTasksSection.style.display = 'none';
        btnExtractText.textContent = 'Extract Actions';
        alert(data.message || 'No actionable tasks found in this email.');
      }

      refreshActionsBadge();

    } catch (err) {
      console.error('Error extracting actions:', err);
      alert(`Action Extraction Error: ${err.message}`);
    } finally {
      btnExtractActions.disabled = false;
      btnExtractSpinner.style.display = 'none';
    }
  }

  // Fetch all tasks for the authenticated user for the My Actions dashboard
  async function fetchUserTasks() {
    if (!actionsTasksContainer) return;
    
    actionsLoadingState.style.display = 'flex';
    actionsEmptyState.style.display = 'none';
    actionsTasksContainer.innerHTML = '';

    try {
      const params = new URLSearchParams({ userEmail });
      if (activeTaskFilter !== 'all') {
        params.set('status', activeTaskFilter);
      }
      if (activePriorityFilter) {
        params.set('priority', activePriorityFilter);
      }

      const response = await fetch(`${API_BASE}/tasks?${params}`, {
        headers: { 'x-user-email': userEmail }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve tasks');
      }

      const tasks = await response.json();
      actionsTasksCache = tasks;
      actionsLoadingState.style.display = 'none';

      if (tasks.length === 0) {
        actionsEmptyState.style.display = 'flex';
        const title = actionsEmptyState.querySelector('.actions-empty-title');
        const subtitle = actionsEmptyState.querySelector('.actions-empty-subtitle');
        if (activeTaskFilter === 'Completed') {
          title.textContent = 'No completed tasks yet';
          subtitle.textContent = 'Complete your pending action items to see them recorded here.';
        } else if (activeTaskFilter === 'Pending') {
          title.textContent = 'No pending tasks!';
          subtitle.textContent = 'Great job! You have cleared all actionable tasks from your emails.';
        } else {
          title.textContent = 'No actionable tasks found';
          subtitle.textContent = 'Open any email and click "Extract Actions" to automatically detect tasks, deadlines, and priorities.';
        }
      } else {
        renderTaskCards(tasks, actionsTasksContainer, false);
      }

      refreshActionsBadge();

    } catch (err) {
      console.error('Error fetching user tasks:', err);
      actionsLoadingState.style.display = 'none';
      showActionBanner('error', `Failed to load actions: ${err.message}`);
    }
  }

  // Render task cards into target container (dashboard or inline email details)
  function renderTaskCards(tasks, container, isInline = false) {
    container.innerHTML = '';

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.status === 'Completed' ? 'completed' : ''}`;
      card.dataset.taskId = task._id;

      // Priority chip
      const priorityClass = `priority-${task.priority.toLowerCase()}`;
      const priorityLabel = `${task.priority} Priority`;

      // Status chip
      const statusClass = task.status.toLowerCase();

      // Deadline chip
      const deadlineInfo = formatTaskDeadline(task.deadline);
      let deadlineHtml = '';
      if (deadlineInfo) {
        const passedClass = deadlineInfo.isOverdue && task.status !== 'Completed' ? 'passed' : '';
        const icon = deadlineInfo.isOverdue && task.status !== 'Completed' ? '⚠️' : '📅';
        deadlineHtml = `<span class="deadline-chip ${passedClass}">${icon} ${deadlineInfo.text}</span>`;
      } else {
        deadlineHtml = `<span class="deadline-chip no-deadline">No deadline</span>`;
      }

      // Reason block
      const reasonHtml = task.reason ? `<div class="task-reason">💡 ${escapeHtml(task.reason)}</div>` : '';

      // Original Email Reference (Show First Name + Last Name of the other party)
      let emailRefHtml = '';
      const emailObj = task.emailId;
      if (!isInline) {
        if (emailObj && typeof emailObj === 'object') {
          const emailSubject = escapeHtml(emailObj.subject || task.emailSubject || '(No Subject)');
          const rawSender = (emailObj.sender || '').toLowerCase();
          const rawReceiver = (emailObj.receiver || '').toLowerCase();
          const currentEmail = userEmail.toLowerCase();

          const senderDisplay = escapeHtml(emailObj.senderName || rawSender.split('@')[0] || 'Unknown');
          const receiverDisplay = escapeHtml(emailObj.receiverName || rawReceiver.split('@')[0] || 'Unknown');

          let displayTarget = '';
          if (currentEmail === rawSender) {
            // Logged in user is the sender: show who it was sent to (First + Last Name)
            displayTarget = `To: ${receiverDisplay}`;
          } else {
            // Logged in user is the recipient: show who it was received from (First + Last Name)
            displayTarget = `From: ${senderDisplay}`;
          }

          if (emailObj.isTrash) {
            emailRefHtml = `
              <a class="task-email-ref in-trash" title="This email is in Bin (${displayTarget}): ${emailSubject}. Click to view" data-email-id="${emailObj._id}" data-in-trash="true">
                🗑️ [In Bin] ✉ ${displayTarget} • ${emailSubject}
              </a>
            `;
          } else if (emailObj.isSpam) {
            emailRefHtml = `
              <a class="task-email-ref in-spam" title="This email is in Spam (${displayTarget}): ${emailSubject}. Click to view" data-email-id="${emailObj._id}" data-in-spam="true">
                🚨 [In Spam] ✉ ${displayTarget} • ${emailSubject}
              </a>
            `;
          } else {
            emailRefHtml = `
              <a class="task-email-ref" title="View email (${displayTarget}): ${emailSubject}" data-email-id="${emailObj._id}">
                ✉ ${displayTarget} • ${emailSubject}
              </a>
            `;
          }
        } else {
          // Original email permanently deleted from database
          const subjectDisplay = task.emailSubject ? ` (${escapeHtml(task.emailSubject)})` : '';
          emailRefHtml = `
            <span class="task-email-ref deleted" title="The source email was permanently deleted, but your task details remain safely saved here.">
              ⚠️ Original email deleted${subjectDisplay}
            </span>
          `;
        }
      }

      card.innerHTML = `
        <div class="task-checkbox-container">
          <input type="checkbox" class="task-checkbox" ${task.status === 'Completed' ? 'checked' : ''} aria-label="Toggle complete task">
        </div>
        <div class="task-details">
          <div class="task-header-line">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <div class="task-badges">
              <span class="priority-chip ${priorityClass}">${priorityLabel}</span>
              <span class="status-chip ${statusClass}">${task.status}</span>
            </div>
          </div>
          ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
          ${reasonHtml}
          <div class="task-meta-footer">
            <div class="task-meta-left">
              ${deadlineHtml}
              ${emailRefHtml}
            </div>
            <div class="task-actions">
              <button type="button" class="btn-task-delete" title="Delete task" aria-label="Delete task">✕</button>
            </div>
          </div>
        </div>
      `;

      // Toggle Task Completion Event
      const checkbox = card.querySelector('.task-checkbox');
      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        const nextStatus = checkbox.checked ? 'Completed' : 'Pending';
        await toggleTaskCompletion(task._id, nextStatus, card, isInline);
      });

      // Delete Task Event
      const deleteBtn = card.querySelector('.btn-task-delete');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this task?')) {
          await deleteTaskItem(task._id, card, isInline);
        }
      });

      // Email Reference Link Click Event
      const emailRefLink = card.querySelector('.task-email-ref[data-email-id]');
      if (emailRefLink) {
        emailRefLink.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetEmailId = emailRefLink.getAttribute('data-email-id');
          await openEmailDetailsById(targetEmailId);
        });
      }

      container.appendChild(card);
    });
  }

  // Toggle Task Completion Status
  async function toggleTaskCompletion(taskId, nextStatus, cardElement, isInline) {
    try {
      // Optimistic UI update
      if (nextStatus === 'Completed') {
        cardElement.classList.add('completed');
      } else {
        cardElement.classList.remove('completed');
      }
      const statusChip = cardElement.querySelector('.status-chip');
      if (statusChip) {
        statusChip.textContent = nextStatus;
        statusChip.className = `status-chip ${nextStatus.toLowerCase()}`;
      }

      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      refreshActionsBadge();

      // If active filter in dashboard is filtered, refresh list
      if (!isInline && activeTaskFilter !== 'all') {
        fetchUserTasks();
      }
    } catch (err) {
      console.error('Error toggling task status:', err);
      // Revert optimistic update
      const checkbox = cardElement.querySelector('.task-checkbox');
      if (checkbox) checkbox.checked = !checkbox.checked;
      cardElement.classList.toggle('completed');
      alert(`Could not update task: ${err.message}`);
    }
  }

  // Delete Task Item
  async function deleteTaskItem(taskId, cardElement, isInline) {
    try {
      cardElement.style.opacity = '0.3';
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': userEmail }
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      cardElement.remove();
      refreshActionsBadge();

      if (isInline) {
        const remaining = emailTasksList.querySelectorAll('.task-card').length;
        emailTasksCount.textContent = `${remaining} item${remaining !== 1 ? 's' : ''}`;
        if (remaining === 0) {
          emailTasksSection.style.display = 'none';
          btnExtractText.textContent = 'Extract Actions';
        }
      } else {
        const remaining = actionsTasksContainer.querySelectorAll('.task-card').length;
        if (remaining === 0) {
          actionsEmptyState.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      cardElement.style.opacity = '1';
      alert(`Could not delete task: ${err.message}`);
    }
  }

  // Open an email by ID (used by task cards to navigate directly to the original email)
  async function openEmailDetailsById(emailId) {
    try {
      if (!emailId) {
        alert('The original email was permanently deleted, but your task details remain safely saved here.');
        return;
      }

      // First check cache
      let foundEmail = emailListCache.find(e => e._id === emailId);
      if (!foundEmail) {
        // Direct ID lookup on the server
        const response = await fetch(`${API_BASE}/emails/${emailId}`, {
          headers: { 'x-user-email': userEmail }
        });
        if (response.ok) {
          foundEmail = await response.json();
        } else if (response.status === 404) {
          alert('The original email was permanently deleted, but your task details remain safely saved here.');
          return;
        } else {
          // Fallback query across folders
          const allRes = await fetch(`${API_BASE}/emails?email=${encodeURIComponent(userEmail)}&folder=all`);
          if (allRes.ok) {
            const allEmails = await allRes.json();
            foundEmail = allEmails.find(e => e._id === emailId);
          }
        }
      }

      if (foundEmail) {
        openEmailDetails(foundEmail);
      } else {
        alert('The original email was permanently deleted, but your task details remain safely saved here.');
      }
    } catch (err) {
      console.error('Error opening source email:', err);
      alert('Error opening original email.');
    }
  }

  // Simple HTML escaping helper for safe text rendering
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Extract Actions button event
  if (btnExtractActions) {
    btnExtractActions.addEventListener('click', (e) => {
      e.stopPropagation();
      extractActionsForCurrentEmail(false);
    });
  }

  // Re-extract button event
  if (btnReExtract) {
    btnReExtract.addEventListener('click', (e) => {
      e.stopPropagation();
      extractActionsForCurrentEmail(true);
    });
  }

  // Action Dashboard Filter Tabs
  actionTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      actionTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTaskFilter = btn.dataset.filter;
      fetchUserTasks();
    });
  });

  // Action Dashboard Priority Filter
  if (actionPriorityFilter) {
    actionPriorityFilter.addEventListener('change', () => {
      activePriorityFilter = actionPriorityFilter.value;
      fetchUserTasks();
    });
  }

  // Details Modal: Back button
  btnDetailsBack.addEventListener('click', async () => {
    closeDetailsModal();
    await fetchEmails(activeFolder);
  });

  // Details Modal: Mark as unread button
  if (detailsActionUnread) {
    detailsActionUnread.addEventListener('click', async () => {
      if (!currentOpenEmail) return;
      const targetIds = (currentOpenEmail.threadEmailIds && currentOpenEmail.threadEmailIds.length > 0)
        ? currentOpenEmail.threadEmailIds
        : [currentOpenEmail._id];
      closeDetailsModal();
      await markEmailsUnread(targetIds);
    });
  }

  emailInfoToggle.addEventListener('click', () => {
    const isExpanded = emailInfoToggle.getAttribute('aria-expanded') === 'true';
    emailInfoToggle.setAttribute('aria-expanded', String(!isExpanded));
    emailInfoPanel.hidden = isExpanded;
  });

  // Details Modal: Star button toggle
  detailsStarButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!currentOpenEmail || isPermanentDeleteFolder()) return;

    const email = currentOpenEmail;
    const previousState = Boolean(email.isStarred);
    const nextState = !previousState;
    email.isStarred = nextState;
    setDetailsStarState(nextState);
    detailsStarButton.disabled = true;

    try {
      const result = await updateEmailStatus(email._id, { isStarred: nextState });
      if (!result || !result.email) {
        email.isStarred = previousState;
        setDetailsStarState(previousState);
        return;
      }

      email.isStarred = result.email.isStarred;
      setDetailsStarState(email.isStarred);
      fetchEmails(activeFolder);
    } finally {
      detailsStarButton.disabled = false;
    }
  });

  // Details Modal: Delete button
  detailsActionDelete.addEventListener('click', async () => {
    if (!currentOpenEmail) return;

    if (isPermanentDeleteFolder()) {
      if (confirm('Permanently delete this conversation?')) {
        const ids = (currentThreadEmails && currentThreadEmails.length > 0)
          ? currentThreadEmails.map(e => e._id)
          : [currentOpenEmail._id];
        for (const id of ids) {
          await deleteEmailPermanently(id);
        }
        closeDetailsModal();
        fetchEmails(activeFolder);
      }
    } else {
      let ids;
      if (activeFolder === 'sent') {
        const sentEmails = (currentThreadEmails || []).filter(m => (m.sender || '').toLowerCase() === userEmail.toLowerCase());
        ids = sentEmails.length > 0 ? sentEmails.map(m => m._id) : [currentOpenEmail._id];
      } else {
        ids = (currentThreadActiveEmails && currentThreadActiveEmails.length > 0)
          ? currentThreadActiveEmails.map(e => e._id)
          : (currentThreadEmails && currentThreadEmails.length > 0 ? currentThreadEmails.map(e => e._id) : [currentOpenEmail._id]);
      }
      closeDetailsModal();
      await moveEmailsToBin(ids);
    }
  });

  // Details Modal: Report spam button
  detailsActionSpam.addEventListener('click', async () => {
    if (!currentOpenEmail) return;
    const { ok } = await reportSpam(currentOpenEmail._id);
    if (!ok) {
      alert('Could not report this message as spam. Please try again.');
      return;
    }
    closeDetailsModal();
    fetchEmails(activeFolder);
  });

  // Details Modal: Not spam button
  detailsActionNotSpam.addEventListener('click', async () => {
    if (!currentOpenEmail || activeFolder !== 'spam') return;
    const { ok } = await markNotSpam(currentOpenEmail._id);
    if (!ok) {
      alert('Could not move this message to the Inbox. Please try again.');
      return;
    }
    closeDetailsModal();
    fetchEmails(activeFolder);
  });

  // Details Modal: Restore button
  detailsActionRestore.addEventListener('click', async () => {
    if (!currentOpenEmail || (!currentOpenEmail.isTrash && activeFolder !== 'bin')) return;

    await restoreEmail(currentOpenEmail._id);
    closeDetailsModal();
    if (activeFolder === 'actions') {
      fetchUserTasks();
    } else {
      fetchEmails(activeFolder);
    }
  });

  // ==========================================
  // 7. SEARCH & ADVANCED FILTER
  // ==========================================

  function applySearch() {
    activeSearchQuery = searchInput.value.trim();
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    closeDetailsModal();
    fetchEmails(activeFolder);
  }

  // Search input typing with debounce
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(applySearch, 300);
  });

  // Enter to search immediately, Escape to clear search
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      window.clearTimeout(searchDebounceTimer);
      applySearch();
    } else if (event.key === 'Escape' && activeSearchQuery) {
      searchInput.value = '';
      activeSearchQuery = '';
      window.clearTimeout(searchDebounceTimer);
      applySearch();
    }
  });

  // Native input 'search' event (when clicking the clear 'x' in input)
  searchInput.addEventListener('search', () => {
    if (!searchInput.value.trim() && activeSearchQuery) {
      activeSearchQuery = '';
      applySearch();
    }
  });

  // Toggle advanced filter dropdown panel
  filterToggle.addEventListener('click', () => {
    const isOpen = !searchFilterPanel.hidden;
    searchFilterPanel.hidden = isOpen;
    filterToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Submit advanced filter form (builds search query with if statements)
  searchFilterForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const searchTerms = [];

    const fromVal = document.getElementById('filter-from').value.trim();
    if (fromVal) {
      searchTerms.push(`from:"${fromVal.replace(/"/g, '')}"`);
    }

    const toVal = document.getElementById('filter-to').value.trim();
    if (toVal) {
      searchTerms.push(`to:"${toVal.replace(/"/g, '')}"`);
    }

    const subjectVal = document.getElementById('filter-subject').value.trim();
    if (subjectVal) {
      searchTerms.push(`subject:"${subjectVal.replace(/"/g, '')}"`);
    }

    const wordsVal = document.getElementById('filter-words').value.trim();
    if (wordsVal) {
      searchTerms.push(`"${wordsVal.replace(/"/g, '')}"`);
    }

    const excludeVal = document.getElementById('filter-exclude').value.trim();
    if (excludeVal) {
      searchTerms.push(`-"${excludeVal.replace(/"/g, '')}"`);
    }

    searchInput.value = searchTerms.join(' ');
    window.clearTimeout(searchDebounceTimer);
    searchFilterPanel.hidden = true;
    filterToggle.setAttribute('aria-expanded', 'false');
    applySearch();
  });

  // Clear advanced filter form
  filterClearBtn.addEventListener('click', () => {
    searchFilterForm.reset();
    searchInput.value = '';
    window.clearTimeout(searchDebounceTimer);
    applySearch();
  });

  // Close filter panel when clicking outside
  document.addEventListener('click', (event) => {
    if (!searchFilterPanel.hidden && !searchFilterPanel.contains(event.target) && !filterToggle.contains(event.target)) {
      searchFilterPanel.hidden = true;
      filterToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ==========================================
  // 8. COMPOSE MODAL & SENDING EMAILS
  // ==========================================

  // Open Compose Modal
  composeBtn.addEventListener('click', () => {
    activeThreadId = null;
    activeInReplyTo = null;
    currentDraftId = null;
    composeAttachments = [];
    renderComposeAttachments();
    composeForm.reset();
    if (chipsContainer) {
      chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());
    }
    if (composeModalTitle) composeModalTitle.textContent = 'New Message';
    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';
    composeModal.style.display = 'flex';
    emailToInput.focus();
  });

  // Close compose modal (auto-saves draft)
  composeCloseBtn.addEventListener('click', async () => {
    if (!await saveDraft()) return;
    closeComposeModal();
    fetchEmails(activeFolder);
  });

  // Minimize compose modal
  composeMinimizeBtn.addEventListener('click', () => {
    composeModal.classList.remove('maximized');
    composeModal.classList.toggle('minimized');
  });

  // Maximize / Restore compose modal
  composeMaximizeBtn.addEventListener('click', () => {
    composeModal.classList.remove('minimized');
    composeModal.classList.toggle('maximized');
    if (composeModal.classList.contains('maximized')) {
      composeMaximizeBtn.textContent = '⤡';
      composeMaximizeBtn.title = 'Restore';
    } else {
      composeMaximizeBtn.textContent = '⤢';
      composeMaximizeBtn.title = 'Maximize';
    }
  });

  // Discard draft button
  composeDiscardBtn.addEventListener('click', async () => {
    if (currentDraftId) {
      await deleteEmailPermanently(currentDraftId);
    }
    closeComposeModal();
    fetchEmails(activeFolder);
  });

  // Add recipient chip badge inside To field
  const addRecipientChip = (email) => {
    const existingChips = Array.from(chipsContainer.querySelectorAll('.recipient-chip'));
    if (existingChips.some(chip => chip.dataset.email === email)) {
      emailToInput.value = '';
      return;
    }

    const chip = document.createElement('div');
    chip.className = 'recipient-chip';
    chip.dataset.email = email;
    chip.innerHTML = `
      <div class="chip-avatar">
        <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </div>
      <span class="chip-text">${email}</span>
      <button type="button" class="chip-close">✕</button>
    `;

    chip.querySelector('.chip-close').addEventListener('click', () => {
      chip.remove();
    });

    chipsContainer.insertBefore(chip, emailToInput);
    emailToInput.value = '';
  };

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

  function renderComposeAttachments() {
    composeAttachmentsList.replaceChildren();
    composeAttachments.forEach(attachment => {
      const chip = document.createElement('div');
      chip.className = 'compose-attachment-chip';
      const label = document.createElement('span');
      label.className = 'compose-attachment-label';
      label.textContent = `${attachment.filename} · ${formatFileSize(attachment.size)}`;
      label.title = `${attachment.filename} (${formatFileSize(attachment.size)})`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'compose-attachment-remove';
      removeButton.setAttribute('aria-label', `Remove ${attachment.filename}`);
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => removeComposeAttachment(attachment));
      chip.append(label, removeButton);
      composeAttachmentsList.appendChild(chip);
    });
  }

  async function ensureDraftForAttachments() {
    if (currentDraftId) return;
    const { receiver, subject, body } = getComposeData();
    const response = await fetch(`${API_BASE}/emails`, {
      method: 'POST',
      headers: tokenHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        sender: userEmail,
        receiver,
        subject,
        body,
        attachments: composeAttachments,
        isDraft: true
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not prepare a draft for attachments.');
    currentDraftId = data.email._id;
  }

  async function uploadComposeAttachments(files) {
    const acceptedFiles = [];
    const rejectedFiles = [];
    const seenKeys = new Set(composeAttachments.map(attachment =>
      `${attachment.filename.toLowerCase()}|${attachment.size}|${attachment.mimeType}`
    ));

    for (const file of files) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const acceptedExtensions = ALLOWED_ATTACHMENT_TYPES[file.type];
      if (!acceptedExtensions || !acceptedExtensions.includes(extension)) {
        rejectedFiles.push(`${file.name}: unsupported file type`);
      } else if (file.size > MAX_ATTACHMENT_SIZE) {
        rejectedFiles.push(`${file.name}: larger than 10 MB`);
      } else {
        const duplicateKey = `${file.name.toLowerCase()}|${file.size}|${file.type}`;
        if (seenKeys.has(duplicateKey)) {
          rejectedFiles.push(`${file.name}: duplicate attachment`);
        } else {
          seenKeys.add(duplicateKey);
          acceptedFiles.push(file);
        }
      }
    }

    const availableSlots = MAX_DRAFT_ATTACHMENTS - composeAttachments.length;
    if (acceptedFiles.length > availableSlots) {
      rejectedFiles.push(`Only ${availableSlots} attachment slot(s) remain (maximum ${MAX_DRAFT_ATTACHMENTS}).`);
      acceptedFiles.splice(Math.max(0, availableSlots));
    }
    if (rejectedFiles.length > 0) {
      alert(`Some files were not added:\n${rejectedFiles.join('\n')}`);
    }
    if (acceptedFiles.length === 0) return;

    attachmentUploadInProgress = true;
    composeAttachButton.disabled = true;
    composeCloseBtn.disabled = true;
    composeDiscardBtn.disabled = true;
    const sendButton = document.getElementById('btn-send-email');
    sendButton.disabled = true;
    try {
      await ensureDraftForAttachments();
      const formData = new FormData();
      acceptedFiles.forEach(file => formData.append('attachments', file));
      const response = await fetch(`${API_BASE}/emails/${currentDraftId}/attachments`, {
        method: 'POST',
        headers: tokenHeaders(),
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not upload selected files.');
      composeAttachments = data.attachments || [];
      renderComposeAttachments();
      refreshDraftBadge();
    } catch (err) {
      console.error('Attachment upload failed:', err);
      alert(err.message || 'Attachment upload failed. Please try again.');
    } finally {
      attachmentUploadInProgress = false;
      composeAttachButton.disabled = false;
      composeCloseBtn.disabled = false;
      composeDiscardBtn.disabled = false;
      sendButton.disabled = false;
    }
  }

  async function removeComposeAttachment(attachment) {
    if (!currentDraftId) {
      composeAttachments = composeAttachments.filter(att =>
        (att._id && attachment._id ? att._id !== attachment._id : att !== attachment)
      );
      renderComposeAttachments();
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/emails/${currentDraftId}/attachments/${attachment._id}`,
        { method: 'DELETE', headers: tokenHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        composeAttachments = data.attachments || [];
      } else {
        composeAttachments = composeAttachments.filter(att =>
          (att._id && attachment._id ? att._id !== attachment._id : att !== attachment)
        );
      }
      renderComposeAttachments();
    } catch (err) {
      console.error('Attachment removal failed:', err);
      composeAttachments = composeAttachments.filter(att =>
        (att._id && attachment._id ? att._id !== attachment._id : att !== attachment)
      );
      renderComposeAttachments();
    }
  }

  composeAttachButton.addEventListener('click', () => composeFileInput.click());
  composeFileInput.addEventListener('change', () => {
    const selectedFiles = Array.from(composeFileInput.files || []);
    composeFileInput.value = '';
    uploadComposeAttachments(selectedFiles);
  });

  // Check recipient on Enter key
  emailToInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let email = emailToInput.value.trim().toLowerCase();
      if (!email) return;

      if (!email.includes('@')) {
        email = `${email}@flow.com`;
      }

      try {
        const response = await fetch(`${API_BASE}/check-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            addRecipientChip(email);
          } else {
            alert('User Not Found');
          }
        } else {
          alert('Error checking user availability.');
        }
      } catch (err) {
        console.error('Check email availability failed:', err);
        alert('Connection Offline! Cannot verify recipient.');
      }
    }
  });

  // Disable native HTML form submission on composeForm completely under all circumstances
  composeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  });

  // Prevent Enter key in subject field from sending or submitting; instead move focus to email body
  emailSubjectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      emailBodyInput.focus();
      return false;
    }
  });

  emailSubjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // Blanket safeguard: Prevent Enter key anywhere in composeForm from submitting or sending email
  composeForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (e.target === emailSubjectInput) {
        e.preventDefault();
        e.stopPropagation();
        emailBodyInput.focus();
        return false;
      }
      // Allow newline in body textarea
      if (e.target === emailBodyInput) {
        return;
      }
      // Allow Enter in emailToInput for adding recipient chips
      if (e.target === emailToInput) {
        return;
      }
      // Block Enter elsewhere
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  // Confirm Send Without Subject Dialog Elements & Handlers
  const confirmSubjectDialog = document.getElementById('confirm-subject-dialog');
  const btnCancelNoSubject = document.getElementById('btn-cancel-no-subject');
  const btnConfirmNoSubject = document.getElementById('btn-confirm-no-subject');
  let pendingSendAction = null;

  function showSendWithoutSubjectDialog(sendAction) {
    pendingSendAction = sendAction;
    if (confirmSubjectDialog) {
      confirmSubjectDialog.style.display = 'flex';
    } else {
      // Fallback confirmation dialog in case element is somehow missing in DOM
      const confirmed = window.confirm('Send without subject?\n\nAre you sure you want to send this message without a subject?');
      if (confirmed && typeof sendAction === 'function') {
        sendAction();
      }
    }
  }

  function closeSendWithoutSubjectDialog() {
    if (confirmSubjectDialog) {
      confirmSubjectDialog.style.display = 'none';
    }
    pendingSendAction = null;
  }

  if (btnCancelNoSubject) {
    btnCancelNoSubject.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSendWithoutSubjectDialog();
      emailSubjectInput.focus();
    });
  }

  if (btnConfirmNoSubject) {
    btnConfirmNoSubject.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = pendingSendAction;
      closeSendWithoutSubjectDialog();
      if (typeof action === 'function') {
        await action();
      }
    });
  }

  if (confirmSubjectDialog) {
    confirmSubjectDialog.addEventListener('click', (e) => {
      if (e.target === confirmSubjectDialog) {
        closeSendWithoutSubjectDialog();
        emailSubjectInput.focus();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmSubjectDialog && confirmSubjectDialog.style.display === 'flex') {
      closeSendWithoutSubjectDialog();
      emailSubjectInput.focus();
    }
  });

  // Dedicated Send Email Handler - Can ONLY be triggered by clicking the Send button
  async function handleSendEmail() {
    let toVal = emailToInput.value.trim().toLowerCase();

    // If typed recipient without pressing enter, verify and convert to chip now
    if (toVal) {
      if (!toVal.includes('@')) {
        toVal = `${toVal}@flow.com`;
      }

      try {
        const response = await fetch(`${API_BASE}/check-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: toVal })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            addRecipientChip(toVal);
            emailToInput.value = '';
          } else {
            alert('User Not Found');
            return;
          }
        } else {
          alert('Error checking user availability.');
          return;
        }
      } catch (err) {
        console.error('Check email availability failed on send:', err);
      }
    }

    const chips = chipsContainer.querySelectorAll('.recipient-chip');
    const recipientEmails = Array.from(chips).map(chip => chip.dataset.email);

    if (recipientEmails.length === 0) {
      alert('Please enter at least one verified recipient.');
      return;
    }

    const subject = emailSubjectInput.value.trim();
    const body = emailBodyInput.value;

    async function executeSend(finalSubject) {
      const allReceiversStr = recipientEmails.join(', ');
      try {
        const response = await fetch(`${API_BASE}/emails`, {
          method: 'POST',
          headers: tokenHeaders({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            sender: userEmail,
            receiver: allReceiversStr,
            subject: finalSubject || '(No Subject)',
            body,
            attachments: composeAttachments,
            ...(currentDraftId ? { draftId: currentDraftId } : {}),
            ...(activeThreadId ? { threadId: activeThreadId } : {}),
            ...(activeInReplyTo ? { inReplyTo: activeInReplyTo } : {})
          })
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          const sentEmail = data.email;

          if (currentDraftId) {
            await deleteEmailPermanently(currentDraftId);
          }

          // Snapshot previous compose data for potential Undo
          const undoContext = {
            recipients: [...recipientEmails],
            subject: finalSubject,
            body,
            attachments: [...composeAttachments],
            threadId: activeThreadId,
            inReplyTo: activeInReplyTo
          };

          closeComposeModal();

          if (emailDetailsModal.style.display === 'flex' && currentOpenEmail) {
            await loadAndRenderThread(currentOpenEmail);
          }
          fetchEmails(activeFolder);
          activeThreadId = null;
          activeInReplyTo = null;

          if (sentEmail && sentEmail._id) {
            showToast({
              message: 'Message sent',
              actionText: 'Undo',
              duration: 8000,
              onAction: async () => {
                try {
                  const undoRes = await fetch(`${API_BASE}/emails/${sentEmail._id}/undo-send`, {
                    method: 'POST',
                    headers: tokenHeaders({ 'Content-Type': 'application/json' })
                  });
                  if (!undoRes.ok) {
                    const errData = await undoRes.json().catch(() => ({}));
                    showToast({ message: errData.message || 'Could not undo send.', duration: 4000 });
                    return;
                  }
                  const undoData = await undoRes.json();
                  const draftEmail = undoData.email;

                  // Restore compose modal with the saved draft email content
                  currentDraftId = draftEmail._id;
                  activeThreadId = undoContext.threadId || null;
                  activeInReplyTo = undoContext.inReplyTo || null;
                  composeAttachments = Array.isArray(draftEmail.attachments) ? [...draftEmail.attachments] : [];
                  renderComposeAttachments();

                  // Restore recipients
                  if (chipsContainer) {
                    chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());
                  }
                  undoContext.recipients.forEach(r => addRecipientChip(r));

                  emailSubjectInput.value = undoContext.subject === '(No Subject)' ? '' : undoContext.subject;
                  emailBodyInput.value = undoContext.body || '';

                  if (composeModalTitle) composeModalTitle.textContent = 'Edit Message';
                  composeModal.classList.remove('maximized', 'minimized');
                  composeModal.style.display = 'flex';
                  emailBodyInput.focus();

                  // Refresh folder list to remove from Sent / threads
                  fetchEmails(activeFolder);
                  if (emailDetailsModal.style.display === 'flex' && currentOpenEmail) {
                    await loadAndRenderThread(currentOpenEmail);
                  }

                  showToast({ message: 'Sending undone.', duration: 4000 });
                } catch (err) {
                  console.error('Error undoing send:', err);
                  showToast({ message: 'Could not undo send. Please try again.', duration: 4000 });
                }
              }
            });
          }
        } else {
          const data = await response.json().catch(() => ({}));
          alert(data.message || 'Could not send email. Please try again.');
        }
      } catch (err) {
        console.error('Send email failed:', err);
        alert(err.message || 'Could not send email. Please try again.');
      }
    }

    // If subject is not given in any type of situation (with or without body), show popup to confirm
    if (!subject) {
      showSendWithoutSubjectDialog(async () => {
        await executeSend('');
      });
      return;
    }

    await executeSend(subject);
  }

  // Bind email sending ONLY to the Send button click
  const sendEmailButton = document.getElementById('btn-send-email') || composeForm.querySelector('.btn-send');
  if (sendEmailButton) {
    sendEmailButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSendEmail();
    });
  }

  function closeComposeModal() {
    activeThreadId = null;
    activeInReplyTo = null;
    currentDraftId = null;
    composeAttachments = [];
    if (composeModalTitle) composeModalTitle.textContent = 'New Message';
    composeModal.style.display = 'none';
    composeForm.reset();
    renderComposeAttachments();
    if (chipsContainer) {
      const chips = chipsContainer.querySelectorAll('.recipient-chip');
      chips.forEach(chip => chip.remove());
    }
  }

  // ==========================================
  // 9. DRAFTS FEATURE
  // ==========================================

  // Read current compose form values (chips + any uncommitted text)
  function getComposeData() {
    const recipients = Array.from(chipsContainer.querySelectorAll('.recipient-chip')).map(chip => chip.dataset.email);
    const typedRecipient = emailToInput.value.trim().toLowerCase();
    if (typedRecipient && !recipients.includes(typedRecipient)) {
      recipients.push(typedRecipient);
    }
    return {
      receiver: recipients.join(', '),
      subject: emailSubjectInput.value.trim(),
      body: emailBodyInput.value
    };
  }

  // Save (create or update) draft in database; delete if user emptied everything
  async function saveDraft() {
    const { receiver, subject, body } = getComposeData();
    const isEmpty = !receiver && !subject && !body.trim() && composeAttachments.length === 0;

    try {
      if (isEmpty) {
        if (currentDraftId) {
          await deleteEmailPermanently(currentDraftId);
          currentDraftId = null;
        }
        return true;
      }

      if (currentDraftId) {
        const response = await fetch(`${API_BASE}/emails/${currentDraftId}/draft`, {
          method: 'PATCH',
          headers: tokenHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ receiver, subject, body })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Failed to update draft.');
      } else {
        const response = await fetch(`${API_BASE}/emails`, {
          method: 'POST',
          headers: tokenHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            sender: userEmail,
            receiver,
            subject,
            body,
            attachments: composeAttachments,
            isDraft: true
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to save draft.');
        currentDraftId = data.email._id;
      }
      return true;
    } catch (err) {
      console.error('Error saving draft:', err);
      alert(err.message || 'Could not save this draft. Your compose window will stay open.');
      return false;
    }
  }

  // Open an existing saved draft inside the compose modal to continue editing
  async function openDraftInCompose(draft) {
    if (attachmentUploadInProgress) {
      alert('Please wait for the selected attachments to finish uploading.');
      return;
    }
    // If another message is already open, keep it as draft first
    if (composeModal.style.display === 'flex') {
      if (!await saveDraft()) return;
      closeComposeModal();
    }

    currentDraftId = draft._id;

    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';

    chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());
    draft.receiver
      .split(',')
      .map(r => r.trim())
      .filter(Boolean)
      .forEach(addRecipientChip);

    emailSubjectInput.value = draft.subject === '(No Subject)' ? '' : draft.subject;
    emailBodyInput.value = draft.body;
    composeAttachments = Array.isArray(draft.attachments) ? draft.attachments : [];
    renderComposeAttachments();

    composeModal.style.display = 'flex';
    emailBodyInput.focus();
  }

  // ==========================================
  // 9b. CONVERSATION THREAD, REPLY & FORWARD (Gmail-style)
  // ==========================================

  // Render cards for deleted messages inside a conversation thread
  function renderDeletedMessageCards(deletedEmails) {
    if (!threadDeletedMessages) return;
    threadDeletedMessages.replaceChildren();

    deletedEmails.forEach((email) => {
      const card = document.createElement('div');
      card.className = 'thread-message-card deleted-card';
      card.setAttribute('data-id', email._id);

      const senderDisplayName = email.senderName || email.firstName || (email.sender || '').split('@')[0] || 'Unknown';
      const senderInitial = senderDisplayName.charAt(0).toUpperCase();
      const senderColor = getAvatarColor(email.sender || senderDisplayName);
      const detailedTime = formatDetailedTimestamp(email.timestamp);
      const recips = formatRecipientsDisplay(email);

      const headerRow = document.createElement('div');
      headerRow.className = 'thread-message-header';
      headerRow.innerHTML = `
        <div class="thread-sender-avatar" style="background-color: ${senderColor}; color: #ffffff;">${escapeHtml(senderInitial)}</div>
        <div class="thread-sender-meta">
          <div class="thread-sender-row">
            <span class="thread-sender-name">${escapeHtml(senderDisplayName)}</span>
            <span class="thread-sender-email">&lt;${escapeHtml(email.sender || '')}&gt;</span>
            <span class="thread-folder-badge thread-bin-badge">Bin</span>
          </div>
          <div class="thread-receiver-row">
            <span>${escapeHtml(recips.shortText)}</span>
          </div>
        </div>
        <div class="thread-header-right">
          <span class="thread-time">${escapeHtml(detailedTime)}</span>
          <button class="deleted-msg-restore-btn" title="Restore this message" type="button">
            Restore
          </button>
          <button class="deleted-msg-delete-btn" title="Delete forever" type="button">
            Delete forever
          </button>
        </div>
      `;

      const restoreBtn = headerRow.querySelector('.deleted-msg-restore-btn');
      restoreBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await restoreEmail(email._id);
        if (currentOpenEmail) {
          await loadAndRenderThread(currentOpenEmail);
        }
        fetchEmails(activeFolder);
      });

      const deleteForeverBtn = headerRow.querySelector('.deleted-msg-delete-btn');
      deleteForeverBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Permanently delete this message?')) {
          await deleteEmailPermanently(email._id);
          if (currentOpenEmail) {
            await loadAndRenderThread(currentOpenEmail);
          }
          fetchEmails(activeFolder);
        }
      });

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'thread-message-body';
      renderFormattedEmailBody(email.body, bodyDiv);

      card.appendChild(headerRow);
      card.appendChild(bodyDiv);

      if (Array.isArray(email.attachments) && email.attachments.length > 0) {
        const attContainer = document.createElement('div');
        attContainer.className = 'thread-message-attachments';
        renderCardAttachments(email, attContainer);
        card.appendChild(attContainer);
      }

      threadDeletedMessages.appendChild(card);
    });
  }

  // Fetch all messages in the conversation thread
  async function loadAndRenderThread(baseEmail) {
    const targetEmail = baseEmail || currentMainEmail || currentOpenEmail;
    if (!targetEmail) return;

    try {
      const response = await fetch(`${API_BASE}/emails/${targetEmail._id}/thread`, {
        headers: tokenHeaders({ 'x-user-email': userEmail })
      });
      if (response.ok) {
        const data = await response.json();
        currentThreadEmails = Array.isArray(data.emails) && data.emails.length > 0 ? data.emails : [targetEmail];
        currentConversationThreadId = data.threadId || targetEmail.threadId || targetEmail._id;
      } else {
        currentThreadEmails = [targetEmail];
        currentConversationThreadId = targetEmail.threadId || targetEmail._id;
      }
    } catch (err) {
      console.error('Error fetching email thread:', err);
      currentThreadEmails = [targetEmail];
      currentConversationThreadId = targetEmail.threadId || targetEmail._id;
    }

    // Deduplicate any duplicate self-sent copies in thread
    const seenMsgSigs = new Set();
    currentThreadEmails = currentThreadEmails.filter(e => {
      const timeMs = new Date(e.timestamp).getTime();
      const roundedTime = Math.floor(timeMs / 3000);
      const sig = `${e.sender}|${e.subject}|${e.body}|${roundedTime}`;
      if (seenMsgSigs.has(sig)) return false;
      seenMsgSigs.add(sig);
      return true;
    });

    // Ensure all fetched messages in the opened thread are marked as read in database & memory
    const unreadThreadMsgIds = currentThreadEmails.filter(e => !e.isRead && !e.isDraft).map(e => e._id);
    if (unreadThreadMsgIds.length > 0) {
      currentThreadEmails.forEach(e => {
        if (!e.isDraft) e.isRead = true;
      });
      Promise.all(unreadThreadMsgIds.map(id => updateEmailStatus(id, { isRead: true }))).then(() => {
        refreshInboxBadge();
      });
    }

    const inBin = activeFolder === 'bin' || Boolean(targetEmail && targetEmail.isTrash);
    const inSpam = activeFolder === 'spam' || Boolean(targetEmail && targetEmail.isSpam);

    if (inBin) {
      currentThreadActiveEmails = currentThreadEmails.filter(e => e.isTrash);
      currentThreadDeletedEmails = [];
    } else {
      currentThreadActiveEmails = currentThreadEmails.filter(e => !e.isTrash);
      currentThreadDeletedEmails = currentThreadEmails.filter(e => e.isTrash);
    }

    // If there are no active emails in this view (e.g. user trashed the last active message in this thread)
    if (currentThreadActiveEmails.length === 0) {
      if (!inBin && currentThreadDeletedEmails.length > 0) {
        closeDetailsModal();
        fetchEmails(activeFolder);
        return;
      }
      currentThreadActiveEmails = currentThreadEmails;
    }

    // Gmail-style Deleted Messages Banner
    if (threadDeletedBanner && threadDeletedText) {
      if (currentThreadDeletedEmails.length > 0) {
        const count = currentThreadDeletedEmails.length;
        threadDeletedText.textContent = `${count} deleted message${count > 1 ? 's' : ''} in this conversation.`;
        if (btnViewDeletedMsg) {
          const isExpanded = threadDeletedMessages && threadDeletedMessages.style.display === 'flex';
          btnViewDeletedMsg.textContent = isExpanded
            ? (count > 1 ? 'Hide messages' : 'Hide message')
            : (count > 1 ? 'View messages' : 'View message');
        }
        threadDeletedBanner.style.display = 'flex';
        renderDeletedMessageCards(currentThreadDeletedEmails);
      } else {
        threadDeletedBanner.style.display = 'none';
        if (threadDeletedMessages) {
          threadDeletedMessages.style.display = 'none';
          threadDeletedMessages.replaceChildren();
        }
      }
    }

    // The latest active message is populated in the main view
    const latestEmail = currentThreadActiveEmails[currentThreadActiveEmails.length - 1] || targetEmail;
    currentMainEmail = latestEmail;
    currentOpenEmail = latestEmail;
    populateMainEmailView(latestEmail);

    // Older messages in conversation rendered into thread-older-messages
    const olderEmails = currentThreadActiveEmails.slice(0, currentThreadActiveEmails.length - 1);
    if (threadOlderMessages) {
      threadOlderMessages.replaceChildren();

      if (olderEmails.length > 0) {
        threadOlderMessages.style.display = 'flex';
        threadOlderMessages.style.flexDirection = 'column';
        threadOlderMessages.style.gap = '8px';
        threadOlderMessages.style.marginBottom = '16px';

        olderEmails.forEach((email) => {
          const card = document.createElement('div');
          card.className = 'thread-message-card collapsed';
          card.setAttribute('data-id', email._id);

          const senderDisplayName = email.senderName || email.firstName || (email.sender || '').split('@')[0] || 'Unknown';
          const senderInitial = senderDisplayName.charAt(0).toUpperCase();
          const senderColor = getAvatarColor(email.sender || senderDisplayName);
          const shortTime = formatTimestamp(email.timestamp);
          const detailedTime = formatDetailedTimestamp(email.timestamp);
          const recips = formatRecipientsDisplay(email);

          // Collapsed row (default for older messages)
          const collapsedRow = document.createElement('div');
          collapsedRow.className = 'thread-message-collapsed-row';
          collapsedRow.innerHTML = `
            <div class="thread-collapsed-avatar" style="background-color: ${senderColor}; color: #ffffff;">${escapeHtml(senderInitial)}</div>
            <span class="thread-collapsed-name">${escapeHtml(senderDisplayName)}</span>
            <span class="thread-collapsed-snippet">${escapeHtml((email.body || '').replace(/\\s+/g, ' ').slice(0, 100))}</span>
            <span class="thread-collapsed-time">${escapeHtml(shortTime)}</span>
            <button class="action-icon-btn thread-star-btn ${email.isStarred ? 'starred' : ''}" title="${email.isStarred ? 'Unstar message' : 'Star message'}" type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </button>
          `;

          const collapsedStarBtn = collapsedRow.querySelector('.thread-star-btn');
          collapsedStarBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nextStarred = !email.isStarred;
            email.isStarred = nextStarred;
            collapsedStarBtn.classList.toggle('starred', nextStarred);
            collapsedStarBtn.title = nextStarred ? 'Unstar message' : 'Star message';
            await updateEmailStatus(email._id, { isStarred: nextStarred });
            fetchEmails(activeFolder);
          });

          // Expanded view (revealed on click)
          const expandedView = document.createElement('div');
          expandedView.className = 'thread-message-expanded';
          expandedView.style.display = 'none';

          const headerRow = document.createElement('div');
          headerRow.className = 'thread-message-header';
          headerRow.innerHTML = `
            <div class="thread-sender-avatar" style="background-color: ${senderColor}; color: #ffffff;">${escapeHtml(senderInitial)}</div>
            <div class="thread-sender-meta">
              <div class="thread-sender-row">
                <span class="thread-sender-name">${escapeHtml(senderDisplayName)}</span>
                <span class="thread-sender-email">&lt;${escapeHtml(email.sender || '')}&gt;</span>
              </div>
              <div class="thread-receiver-row">
                <span>${escapeHtml(recips.shortText)}</span>
              </div>
            </div>
            <div class="thread-header-right">
              <span class="thread-time">${escapeHtml(detailedTime)}</span>
              <button class="action-icon-btn thread-star-btn ${email.isStarred ? 'starred' : ''}" title="${email.isStarred ? 'Unstar message' : 'Star message'}" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              </button>
              <button class="action-icon-btn thread-quick-reply-btn" title="Reply" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                </svg>
              </button>
              <button class="action-icon-btn thread-forward-btn" title="Forward" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
                </svg>
              </button>
              <button class="action-icon-btn thread-delete-btn" title="Move to Bin" type="button">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          `;

          const starBtn = headerRow.querySelector('.thread-star-btn');
          starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nextStarred = !email.isStarred;
            email.isStarred = nextStarred;
            starBtn.classList.toggle('starred', nextStarred);
            collapsedStarBtn.classList.toggle('starred', nextStarred);
            starBtn.title = nextStarred ? 'Unstar message' : 'Star message';
            await updateEmailStatus(email._id, { isStarred: nextStarred });
            fetchEmails(activeFolder);
          });

          headerRow.querySelector('.thread-quick-reply-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            triggerReply(email);
          });

          headerRow.querySelector('.thread-forward-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            triggerForward(email);
          });

          headerRow.querySelector('.thread-delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (inBin) {
              if (confirm('Permanently delete this message?')) {
                await deleteEmailPermanently(email._id);
                await loadAndRenderThread(currentOpenEmail);
                fetchEmails(activeFolder);
              }
            } else {
              await moveEmailsToBin([email._id], 'Message moved to Bin.');
              await loadAndRenderThread(currentOpenEmail);
            }
          });

          const bodyDiv = document.createElement('div');
          bodyDiv.className = 'thread-message-body';
          renderFormattedEmailBody(email.body, bodyDiv);

          expandedView.appendChild(headerRow);
          expandedView.appendChild(bodyDiv);

          if (Array.isArray(email.attachments) && email.attachments.length > 0) {
            const attContainer = document.createElement('div');
            attContainer.className = 'thread-message-attachments';
            renderCardAttachments(email, attContainer);
            expandedView.appendChild(attContainer);
          }

          card.appendChild(collapsedRow);
          card.appendChild(expandedView);

          card.addEventListener('click', () => {
            const isCollapsed = card.classList.contains('collapsed');
            if (isCollapsed) {
              card.classList.remove('collapsed');
              collapsedRow.style.display = 'none';
              expandedView.style.display = 'block';
            } else {
              card.classList.add('collapsed');
              collapsedRow.style.display = 'flex';
              expandedView.style.display = 'none';
            }
          });

          threadOlderMessages.appendChild(card);
        });
      } else {
        threadOlderMessages.style.display = 'none';
      }
    }

    // Determine Reply all availability for the latest message
    const participants = new Set();
    if (latestEmail.sender && latestEmail.sender.toLowerCase() !== userEmail.toLowerCase()) {
      participants.add(latestEmail.sender.toLowerCase());
    }
    if (latestEmail.receiver) {
      latestEmail.receiver.split(',').forEach(r => {
        const clean = r.trim().toLowerCase();
        if (clean && clean !== userEmail.toLowerCase()) {
          participants.add(clean);
        }
      });
    }

    const canReplyOrForward = !inBin && !inSpam && !latestEmail.isDraft;

    if (btnDetailReplyAll) {
      btnDetailReplyAll.style.display = (canReplyOrForward && participants.size > 1) ? 'inline-flex' : 'none';
    }
    if (replyForwardBar) {
      replyForwardBar.style.display = canReplyOrForward ? 'flex' : 'none';
    }
    if (btnHeaderReply) {
      btnHeaderReply.style.display = canReplyOrForward ? 'inline-flex' : 'none';
    }
    if (btnHeaderForward) {
      btnHeaderForward.style.display = canReplyOrForward ? 'inline-flex' : 'none';
    }

    if (detailsSenderInfo) {
      if (currentThreadDeletedEmails.length > 0 || (olderEmails && olderEmails.length > 0)) {
        detailsSenderInfo.classList.add('has-previous-messages');
      } else {
        detailsSenderInfo.classList.remove('has-previous-messages');
      }
    }
  }

  // Render individual card attachments inside thread messages
  function renderCardAttachments(email, container) {
    const attachments = Array.isArray(email.attachments) ? email.attachments : [];
    if (attachments.length === 0) return;

    const list = document.createElement('div');
    list.className = 'email-attachments-list';

    attachments.forEach(attachment => {
      const card = createAttachmentCard(email, attachment);
      list.appendChild(card);
    });

    container.appendChild(list);
  }

  // Open compose modal populated with Reply content
  async function triggerReply(specificEmail = null) {
    const email = specificEmail || (currentThreadEmails && currentThreadEmails.length > 0 
      ? currentThreadEmails[currentThreadEmails.length - 1] 
      : currentOpenEmail);

    if (!email) return;
    if (attachmentUploadInProgress) {
      alert('Please wait for attachments to finish uploading.');
      return;
    }

    // If another message is currently being composed, auto-save it as draft first
    if (composeModal.style.display === 'flex') {
      if (!await saveDraft()) return;
      closeComposeModal();
    }

    currentDraftId = null;
    composeAttachments = [];
    renderComposeAttachments();

    // Link this reply to the current conversation thread!
    activeThreadId = currentConversationThreadId || email.threadId || email._id;
    activeInReplyTo = email._id;

    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';
    if (composeModalTitle) composeModalTitle.textContent = 'Reply';

    // Clear recipient chips
    chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());

    // Reply recipient: if email sender is current user, reply to receiver; else reply to sender
    const replyRecipient = (email.sender && email.sender.toLowerCase() === userEmail.toLowerCase())
      ? (email.receiver ? email.receiver.split(',')[0].trim() : '')
      : (email.sender || '');

    if (replyRecipient) {
      addRecipientChip(replyRecipient);
    }

    // Clean subject and prepend Re:
    const origSubject = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubject = origSubject.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();
    emailSubjectInput.value = cleanSubject ? `Re: ${cleanSubject}` : 'Re: ';

    // Quoted message body with standard email formatting (no '>' marks, rendered with Gmail-style line)
    const senderName = email.senderName || email.firstName || (email.sender ? email.sender.split('@')[0] : 'Unknown');
    const dateStr = formatGmailQuoteDate(email.timestamp);
    const cleanBody = (email.body || '').replace(/^[>\s]+/gm, '');

    emailBodyInput.value = `\n\n\nOn ${dateStr} ${senderName} <${email.sender}> wrote:\n${cleanBody}`;

    composeModal.style.display = 'flex';
    emailBodyInput.focus();
    emailBodyInput.setSelectionRange(0, 0);
  }

  // Open compose modal populated with Reply all content
  async function triggerReplyAll(specificEmail = null) {
    const email = specificEmail || currentMainEmail || (currentThreadEmails && currentThreadEmails.length > 0
      ? currentThreadEmails[currentThreadEmails.length - 1]
      : currentOpenEmail);

    if (!email) return;
    if (attachmentUploadInProgress) {
      alert('Please wait for attachments to finish uploading.');
      return;
    }

    if (composeModal.style.display === 'flex') {
      if (!await saveDraft()) return;
      closeComposeModal();
    }

    currentDraftId = null;
    composeAttachments = [];
    renderComposeAttachments();

    // Link this reply to the current conversation thread!
    activeThreadId = currentConversationThreadId || email.threadId || email._id;
    activeInReplyTo = email._id;

    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';
    if (composeModalTitle) composeModalTitle.textContent = 'Reply all';

    chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());

    // Collect all participants across the conversation:
    // Original sender + other recipients, excluding the logged-in user
    const recipientsSet = new Set();
    if (email.sender && email.sender.toLowerCase() !== userEmail.toLowerCase()) {
      recipientsSet.add(email.sender.toLowerCase());
    }
    if (email.receiver) {
      email.receiver.split(',').forEach(r => {
        const clean = r.trim().toLowerCase();
        if (clean && clean !== userEmail.toLowerCase()) {
          recipientsSet.add(clean);
        }
      });
    }

    if (recipientsSet.size === 0 && email.receiver) {
      email.receiver.split(',').forEach(r => {
        const clean = r.trim().toLowerCase();
        if (clean) recipientsSet.add(clean);
      });
    }

    recipientsSet.forEach(r => addRecipientChip(r));

    // Clean subject and prepend Re:
    const origSubject = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubject = origSubject.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();
    emailSubjectInput.value = cleanSubject ? `Re: ${cleanSubject}` : 'Re: ';

    // Quoted message body with standard email formatting (no '>' marks, rendered with Gmail-style line)
    const senderName = email.senderName || email.firstName || (email.sender ? email.sender.split('@')[0] : 'Unknown');
    const dateStr = formatGmailQuoteDate(email.timestamp);
    const cleanBody = (email.body || '').replace(/^[>\s]+/gm, '');

    emailBodyInput.value = `\n\n\nOn ${dateStr} ${senderName} <${email.sender}> wrote:\n${cleanBody}`;

    composeModal.style.display = 'flex';
    emailBodyInput.focus();
    emailBodyInput.setSelectionRange(0, 0);
  }

  // Open compose modal populated with Forward content
  async function triggerForward(specificEmail = null) {
    const email = specificEmail || currentMainEmail || (currentThreadEmails && currentThreadEmails.length > 0
      ? currentThreadEmails[currentThreadEmails.length - 1]
      : currentOpenEmail);

    if (!email) return;
    if (attachmentUploadInProgress) {
      alert('Please wait for attachments to finish uploading.');
      return;
    }

    if (composeModal.style.display === 'flex') {
      if (!await saveDraft()) return;
      closeComposeModal();
    }

    currentDraftId = null;
    composeAttachments = Array.isArray(email.attachments) ? [...email.attachments] : [];
    renderComposeAttachments();

    // Forwards start a new conversation
    activeThreadId = null;
    activeInReplyTo = email._id;

    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';
    if (composeModalTitle) composeModalTitle.textContent = 'Forward';

    chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());
    emailToInput.value = '';

    // Clean subject and prepend Fwd:
    const origSubject = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubject = origSubject.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();
    emailSubjectInput.value = cleanSubject ? `Fwd: ${cleanSubject}` : 'Fwd: ';

    // Forwarded message body header matching Gmail format
    const senderName = email.senderName || email.firstName || (email.sender ? email.sender.split('@')[0] : 'Unknown');
    const dateStr = formatFullTimestamp(email.timestamp);
    const recips = formatRecipientsDisplay(email);

    emailBodyInput.value = `\n\n\n---------- Forwarded message ---------\nFrom: ${senderName} <${email.sender}>\nDate: ${dateStr}\nSubject: ${origSubject || '(No Subject)'}\nTo: ${recips.fullText || email.receiver || ''}\n\n${email.body || ''}`;

    composeModal.style.display = 'flex';
    emailToInput.focus();
  }

  // Bind Header actions (Star, Reply, Forward, Delete) and Bottom Reply/Forward buttons
  if (btnHeaderStar) {
    btnHeaderStar.addEventListener('click', async () => {
      const target = currentMainEmail || currentOpenEmail;
      if (!target) return;
      const nextStarred = !target.isStarred;
      target.isStarred = nextStarred;
      setDetailsStarState(nextStarred);
      await updateEmailStatus(target._id, { isStarred: nextStarred });
      fetchEmails(activeFolder);
    });
  }

  if (btnHeaderReply) btnHeaderReply.addEventListener('click', () => triggerReply(currentMainEmail || currentOpenEmail));
  if (btnHeaderForward) btnHeaderForward.addEventListener('click', () => triggerForward(currentMainEmail || currentOpenEmail));

  if (btnHeaderDelete) {
    btnHeaderDelete.addEventListener('click', async () => {
      const target = currentMainEmail || currentOpenEmail;
      if (!target) return;

      if (isPermanentDeleteFolder()) {
        if (confirm('Permanently delete this email?')) {
          await deleteEmailPermanently(target._id);
          const remaining = (currentThreadEmails || []).filter(e => e._id !== target._id);
          if (remaining.length > 0) {
            await loadAndRenderThread(remaining[remaining.length - 1]);
          } else {
            closeDetailsModal();
          }
          fetchEmails(activeFolder);
        }
      } else {
        const remainingActive = (currentThreadActiveEmails || []).filter(e => e._id !== target._id);
        if (remainingActive.length > 0) {
          await moveEmailsToBin([target._id], 'Message moved to Bin.');
          await loadAndRenderThread(remainingActive[remainingActive.length - 1]);
        } else {
          closeDetailsModal();
          await moveEmailsToBin([target._id]);
        }
      }
    });
  }

  if (btnDetailReply) btnDetailReply.addEventListener('click', () => triggerReply(currentMainEmail || currentOpenEmail));
  if (btnDetailReplyAll) btnDetailReplyAll.addEventListener('click', triggerReplyAll);
  if (btnDetailForward) btnDetailForward.addEventListener('click', () => triggerForward(currentMainEmail || currentOpenEmail));

  // Deleted messages in conversation banner links
  if (btnViewDeletedMsg) {
    btnViewDeletedMsg.addEventListener('click', (e) => {
      e.preventDefault();
      if (!threadDeletedMessages) return;
      const isHidden = threadDeletedMessages.style.display === 'none' || !threadDeletedMessages.style.display;
      if (isHidden) {
        threadDeletedMessages.style.display = 'flex';
        btnViewDeletedMsg.textContent = currentThreadDeletedEmails.length > 1 ? 'Hide messages' : 'Hide message';
      } else {
        threadDeletedMessages.style.display = 'none';
        btnViewDeletedMsg.textContent = currentThreadDeletedEmails.length > 1 ? 'View messages' : 'View message';
      }
    });
  }

  if (btnDeleteForeverMsg) {
    btnDeleteForeverMsg.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentThreadDeletedEmails || currentThreadDeletedEmails.length === 0) return;
      if (confirm('Permanently delete all deleted messages in this conversation?')) {
        for (const msg of currentThreadDeletedEmails) {
          await deleteEmailPermanently(msg._id);
        }
        const activeTarget = currentMainEmail || currentOpenEmail;
        if (activeTarget) {
          await loadAndRenderThread(activeTarget);
        } else {
          closeDetailsModal();
        }
        fetchEmails(activeFolder);
      }
    });
  }

  // Show number of drafts in sidebar badge even when another folder is open
  async function refreshDraftBadge() {
    try {
      const response = await fetch(`${API_BASE}/emails?email=${encodeURIComponent(userEmail)}&folder=drafts`);
      if (!response.ok) return;
      const drafts = await response.json();
      document.getElementById('badge-drafts').textContent = drafts.length > 0 ? drafts.length : '';
    } catch (err) {
      console.error('Error refreshing drafts badge:', err);
    }
  }

  // Show number of unread emails in inbox badge even when another folder is open
  async function refreshInboxBadge() {
    try {
      const response = await fetch(`${API_BASE}/emails?email=${encodeURIComponent(userEmail)}&folder=inbox`);
      if (!response.ok) return;
      const emails = await response.json();
      const unreadCount = emails.filter(m => !m.isRead).length;
      const inboxBadge = document.getElementById('badge-inbox');
      if (inboxBadge) {
        inboxBadge.textContent = unreadCount > 0 ? unreadCount : '';
      }
    } catch (err) {
      console.error('Error refreshing inbox badge:', err);
    }
  }

  // ==========================================
  // 10. TOOLBAR & FOLDER NAVIGATION
  // ==========================================

  // Sidebar mobile toggle
  sidebarToggleBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      document.querySelector('.app-container').classList.remove('collapsed');
    } else {
      document.querySelector('.app-container').classList.toggle('collapsed');
      sidebar.classList.remove('open');
    }
  });

  // Folder switching handlers (Inbox, Starred, Sent, Drafts, Bin, All)
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // Clear selections
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      activeLabelId = null;
      renderLabelSidebar();

      // Toggle active states
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      activeFolder = item.getAttribute('data-folder');
      updateDeleteButtonState();

      closeDetailsModal();
      fetchEmails(activeFolder);

      // Close sidebar in mobile view
      sidebar.classList.remove('open');
    });
  });

  // Refresh toolbar button with Gmail-style smooth spin and multi-data reload
  let isRefreshing = false;
  refreshActionBarBtn.addEventListener('click', async () => {
    if (isRefreshing) return;
    isRefreshing = true;

    refreshActionBarBtn.classList.add('refreshing');
    refreshActionBarBtn.setAttribute('title', 'Refreshing...');
    refreshActionBarBtn.setAttribute('aria-busy', 'true');

    // Reset selection checkboxes
    selectAllCheckbox.checked = false;
    selectedEmailIds.clear();
    updateDeleteButtonState();

    try {
      // Reload current folder emails and all sidebar badges with a minimum spin time for smooth feel
      await Promise.all([
        fetchEmails(activeFolder),
        refreshInboxBadge(),
        refreshDraftBadge(),
        refreshSpamBadge(),
        refreshActionsBadge(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);
    } catch (err) {
      console.error('Error during refresh:', err);
    } finally {
      refreshActionBarBtn.classList.remove('refreshing');
      refreshActionBarBtn.setAttribute('title', 'Refresh');
      refreshActionBarBtn.removeAttribute('aria-busy');
      isRefreshing = false;
    }
  });

  // Select all checkboxes toggle
  selectAllCheckbox.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.email-row-select');
    if (selectAllCheckbox.checked) {
      checkboxes.forEach(cb => {
        cb.checked = true;
        selectedEmailIds.add(cb.getAttribute('data-id'));
      });
    } else {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      selectedEmailIds.clear();
    }
    updateDeleteButtonState();
  });

  // Bulk Delete toolbar button
  deleteActionBarBtn.addEventListener('click', async () => {
    if (selectedEmailIds.size === 0) return;

    if (isPermanentDeleteFolder()) {
      if (confirm(`Permanently delete ${selectedEmailIds.size} email(s)?`)) {
        for (const id of selectedEmailIds) {
          await deleteEmailPermanently(id);
        }
        selectedEmailIds.clear();
        selectAllCheckbox.checked = false;
        updateDeleteButtonState();
        fetchEmails(activeFolder);
      }
    } else {
      const idsToDelete = Array.from(selectedEmailIds);
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      await moveEmailsToBin(idsToDelete);
    }
  });

  // Bulk Report spam toolbar button (Inbox / Starred / All Mail / Bin)
  spamActionBarBtn.addEventListener('click', async () => {
    const reportableIds = Array.from(selectedEmailIds).filter(id =>
      canReportSpam(emailListCache.find(e => e._id === id))
    );
    if (reportableIds.length === 0) return;

    const results = await Promise.all(reportableIds.map(id => reportSpam(id)));
    if (results.some(r => !r.ok)) {
      alert('Some messages could not be reported as spam.');
    }
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    fetchEmails(activeFolder);
  });

  // Bulk Not spam toolbar button (Spam only)
  notSpamActionBarBtn.addEventListener('click', async () => {
    if (activeFolder !== 'spam' || selectedEmailIds.size === 0) return;

    const results = await Promise.all(Array.from(selectedEmailIds).map(id => markNotSpam(id)));
    if (results.some(r => !r.ok)) {
      alert('Some messages could not be moved to the Inbox.');
    }
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    fetchEmails(activeFolder);
  });

  unreadActionBarBtn.addEventListener('click', async () => {
    if (unreadActionBarBtn.disabled || selectedEmailIds.size === 0) return;
    const ids = Array.from(selectedEmailIds);
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    const allIds = [];
    ids.forEach(id => {
      const found = emailListCache.find(e => String(e._id) === String(id));
      if (found && found.threadEmailIds && found.threadEmailIds.length > 0) {
        allIds.push(...found.threadEmailIds);
      } else {
        allIds.push(id);
      }
    });
    await markEmailsUnread([...new Set(allIds)]);
  });

  if (readActionBarBtn) {
    readActionBarBtn.addEventListener('click', async () => {
      if (readActionBarBtn.disabled || selectedEmailIds.size === 0) return;
      const ids = Array.from(selectedEmailIds);
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      const allIds = [];
      ids.forEach(id => {
        const found = emailListCache.find(e => String(e._id) === String(id));
        if (found && found.threadEmailIds && found.threadEmailIds.length > 0) {
          allIds.push(...found.threadEmailIds);
        } else {
          allIds.push(id);
        }
      });
      await markEmailsRead([...new Set(allIds)]);
    });
  }

  // Bulk Restore toolbar button (Bin only)
  restoreActionBarBtn.addEventListener('click', async () => {
    if (activeFolder !== 'bin' || selectedEmailIds.size === 0) return;

    await Promise.all(Array.from(selectedEmailIds).map(id => restoreEmail(id)));
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    fetchEmails(activeFolder);
  });

  // ==========================================
  // 10.5. EMPTY BIN / DELETE ALL SPAM NOW
  // ==========================================

  let folderPendingEmpty = null; // 'bin' or 'spam' while the confirmation dialog is open

  function openEmptyFolderDialog() {
    const notice = FOLDER_NOTICES[activeFolder];
    if (!notice) return;

    folderPendingEmpty = activeFolder;
    confirmEmptyTitle.textContent = notice.dialogTitle;
    confirmEmptyBody.textContent = notice.dialogBody;
    btnConfirmEmpty.disabled = false;
    confirmEmptyDialog.style.display = 'flex';
  }

  function closeEmptyFolderDialog() {
    confirmEmptyDialog.style.display = 'none';
    folderPendingEmpty = null;
  }

  folderBannerBtn.addEventListener('click', openEmptyFolderDialog);
  btnCancelEmpty.addEventListener('click', closeEmptyFolderDialog);

  // Click on the dark backdrop cancels
  confirmEmptyDialog.addEventListener('click', (e) => {
    if (e.target === confirmEmptyDialog) closeEmptyFolderDialog();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmEmptyDialog.style.display === 'flex') {
      closeEmptyFolderDialog();
    }
  });

  btnConfirmEmpty.addEventListener('click', async () => {
    const folder = folderPendingEmpty;
    if (!folder) return;

    btnConfirmEmpty.disabled = true; // prevent double clicks
    try {
      await emptyFolderNow(folder);
      closeEmptyFolderDialog();
      closeDetailsModal();
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      fetchEmails(activeFolder);
    } catch (err) {
      console.error('Error emptying folder:', err);
      closeEmptyFolderDialog();
      alert(`Could not empty the folder: ${err.message}`);
    }
  });

  // ==========================================
  // 11. UI STATE & DATE FORMATTING HELPERS
  // ==========================================

  // Enable/disable toolbar action buttons based on selection and folder
  function updateDeleteButtonState() {
    const hasSelection = selectedEmailIds.size > 0;
    bulkLabelActions.hidden = !hasSelection || customLabels.length === 0;
    const labelActionsDisabled = !hasSelection || !bulkLabelSelect.value;
    bulkLabelApply.disabled = labelActionsDisabled;
    bulkLabelRemove.disabled = labelActionsDisabled;
    if (hasSelection) {
      deleteActionBarBtn.removeAttribute('disabled');
    } else {
      deleteActionBarBtn.setAttribute('disabled', 'true');
    }
    restoreActionBarBtn.disabled = !hasSelection;
    restoreActionBarBtn.style.display = activeFolder === 'bin' ? 'flex' : 'none';
    const hasUnreadEligibleSelection = (UNREAD_ACTION_FOLDERS.includes(activeFolder) || Boolean(activeLabelId))
      && emailListCache.some(email =>
        selectedEmailIds.has(String(email._id))
        && canToggleReadStatus(email)
        && email.isRead
      );
    unreadActionBarBtn.style.display = hasUnreadEligibleSelection ? 'flex' : 'none';
    unreadActionBarBtn.disabled = !hasUnreadEligibleSelection;

    const hasReadEligibleSelection = (UNREAD_ACTION_FOLDERS.includes(activeFolder) || Boolean(activeLabelId))
      && emailListCache.some(email =>
        selectedEmailIds.has(String(email._id))
        && canToggleReadStatus(email)
        && !email.isRead
      );
    if (readActionBarBtn) {
      readActionBarBtn.style.display = hasReadEligibleSelection ? 'flex' : 'none';
      readActionBarBtn.disabled = !hasReadEligibleSelection;
    }
    deleteActionBarBtn.title = activeFolder === 'bin'
      ? 'Permanently delete'
      : activeFolder === 'spam' ? 'Delete forever' : 'Move to Bin';

    // Report spam: shown in Inbox / Starred / All Mail / Bin, enabled when a received email is selected
    const showReportSpam = REPORT_SPAM_FOLDERS.includes(activeFolder);
    const hasReportable = Array.from(selectedEmailIds).some(id =>
      canReportSpam(emailListCache.find(e => e._id === id))
    );
    spamActionBarBtn.style.display = showReportSpam ? 'flex' : 'none';
    spamActionBarBtn.disabled = !hasReportable;

    // Not spam: shown only inside the Spam folder
    notSpamActionBarBtn.style.display = activeFolder === 'spam' ? 'inline-block' : 'none';
    notSpamActionBarBtn.disabled = !hasSelection;
  }

  // Simple line icons for the empty states (inline SVG, no extra image files needed)
  const EMPTY_ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const EMPTY_ICONS = {
    inbox: `<svg ${EMPTY_ICON_ATTRS}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    starred: `<svg ${EMPTY_ICON_ATTRS}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    sent: `<svg ${EMPTY_ICON_ATTRS}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    drafts: `<svg ${EMPTY_ICON_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
    spam: `<svg ${EMPTY_ICON_ATTRS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
    bin: `<svg ${EMPTY_ICON_ATTRS}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    search: `<svg ${EMPTY_ICON_ATTRS}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
  };

  // Text + icon for each folder's empty state. "good" = a calm green icon (nothing bad here).
  const EMPTY_STATES = {
    inbox: {
      icon: 'inbox',
      title: 'Your inbox is empty',
      subtitle: "You're all caught up. New mail will show up here."
    },
    starred: {
      icon: 'starred',
      title: 'No starred messages',
      subtitle: 'Stars let you give messages a special status to make them easier to find.'
    },
    sent: {
      icon: 'sent',
      title: 'No sent messages',
      subtitle: "Messages you send will be listed here."
    },
    drafts: {
      icon: 'drafts',
      title: "You don't have any saved drafts",
      subtitle: "Saving a draft allows you to keep a message you aren't ready to send yet."
    },
    spam: {
      icon: 'spam',
      good: true,
      title: 'No spam, great!',
      subtitle: `Messages detected as spam appear here and are deleted automatically after ${RETENTION_DAYS} days.`
    },
    bin: {
      icon: 'bin',
      title: 'Bin is empty',
      subtitle: `Deleted messages stay here for ${RETENTION_DAYS} days before they are removed for good.`
    },
    all: {
      icon: 'inbox',
      title: 'No mail yet',
      subtitle: 'Everything you send and receive will show up here.'
    }
  };

  // Display empty folder placeholder
  function showEmptyState(folder, searching = false) {
    emptyStateView.style.display = 'flex';
    mailListWrapper.style.display = 'none';

    const icon = document.getElementById('empty-icon');
    const title = emptyStateView.querySelector('.empty-title');
    const subtitle = emptyStateView.querySelector('.empty-subtitle');

    let state;
    if (activeLabelId && !searching) {
      const label = customLabels.find(item => item._id === activeLabelId);
      state = {
        icon: 'inbox',
        title: 'No messages with this label',
        subtitle: label ? `Messages with "${label.name}" will appear here.` : 'This label has no messages yet.'
      };
    } else if (searching) {
      state = {
        icon: 'search',
        title: 'No matching messages',
        subtitle: 'Try different search terms or check the spelling.'
      };
    } else {
      state = EMPTY_STATES[folder] || EMPTY_STATES.all;
    }

    icon.innerHTML = EMPTY_ICONS[state.icon] || '';
    icon.classList.toggle('is-good', Boolean(state.good));
    title.textContent = state.title;
    subtitle.textContent = state.subtitle;
  }

  // Update folder count badge numbers in sidebar
  function updateFolderBadges(emails) {
    const inboxBadge = document.getElementById('badge-inbox');
    const draftsBadge = document.getElementById('badge-drafts');

    if (activeFolder === 'inbox') {
      const unreadCount = emails.filter(m => !m.isRead).length;
      inboxBadge.textContent = unreadCount > 0 ? unreadCount : '';
    }
    if (activeFolder === 'drafts') {
      draftsBadge.textContent = emails.length > 0 ? emails.length : '';
    }
    if (activeFolder === 'spam') {
      const spamBadge = document.getElementById('badge-spam');
      const unreadSpam = emails.filter(m => !m.isRead).length;
      spamBadge.textContent = unreadSpam > 0 ? unreadSpam : '';
    }
  }

  // Format short timestamp for email row (e.g., 5:10 PM or Aug 9)
  function formatTimestamp(timestampStr) {
    const date = new Date(timestampStr);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Format detailed timestamp for overlay view
  function formatDetailedTimestamp(timestampStr) {
    const date = new Date(timestampStr);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    const dateStr = date.toLocaleString('en-US', options);

    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let agoStr = '';
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        agoStr = `(${diffMinutes} min ago)`;
      } else {
        agoStr = `(${diffHours} hour${diffHours !== 1 ? 's' : ''} ago)`;
      }
    } else {
      agoStr = `(${diffDays} day${diffDays !== 1 ? 's' : ''} ago)`;
    }

    return `${dateStr} ${agoStr}`;
  }

  // ==========================================
  // 12. APP INITIALIZATION
  // ==========================================
  loadLabels().finally(() => {
    fetchEmails(activeFolder);
  });
  refreshInboxBadge();
  refreshActionsBadge();
  refreshSpamBadge();
  updateDeleteButtonState(); // sets the initial visibility of Report spam / Not spam buttons

});
