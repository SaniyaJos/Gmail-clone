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

  // Set avatar initial title and bind dropdown
  const headerAvatar = document.getElementById('header-avatar');
  const accountDropdown = document.getElementById('account-dropdown');
  const dropdownAvatar = document.getElementById('dropdown-avatar');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownEmail = document.getElementById('dropdown-email');
  const btnLogout = document.getElementById('btn-dropdown-logout');

  if (headerAvatar && currentUser.firstName) {
    headerAvatar.title = `${currentUser.firstName} (${userEmail})`;

    if (dropdownAvatar && dropdownName && dropdownEmail) {
      dropdownAvatar.textContent = currentUser.firstName.charAt(0).toUpperCase();
      dropdownName.textContent = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
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

  // Toolbar Action Controls
  const selectAllCheckbox = document.getElementById('select-all');
  const deleteActionBarBtn = document.getElementById('action-delete');
  const restoreActionBarBtn = document.getElementById('action-restore');
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
  const detailsActionRestore = document.getElementById('details-action-restore');
  const detailsActionDelete = document.getElementById('details-action-delete');
  const detailsActionSpam = document.getElementById('details-action-spam');
  const detailsActionNotSpam = document.getElementById('details-action-not-spam');
  const spamWarning = document.getElementById('spam-warning');
  const spamWarningReasons = document.getElementById('spam-warning-reasons');
  const detailsStarButton = document.getElementById('details-star-button');
  const detailsStarIcon = detailsStarButton.querySelector('.details-star-icon');
  const detailsSubject = document.getElementById('details-subject');
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
      const response = await fetch(`${API_BASE}/emails?${params}`);
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

  // Bin and Spam both delete forever (every other folder moves to Bin)
  function isPermanentDeleteFolder() {
    return activeFolder === 'bin' || activeFolder === 'spam';
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

  // Folders where "Report spam" is available (Bin included: reporting moves the mail out of Bin into Spam)
  const REPORT_SPAM_FOLDERS = ['inbox', 'starred', 'all', 'bin'];

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

  function renderEmailList(emails) {
    emailListUl.innerHTML = '';

    // Update Badge counts for Inbox and Drafts
    if (!activeSearchQuery) updateFolderBadges(emails);
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

      // Determine sender display: if user is sender, display receiver email
      let displaySender = email.sender === userEmail
        ? `To: ${escapeHtml(email.receiver)}`
        : escapeHtml(email.firstName || email.sender.split('@')[0]);
      if (email.isDraft) {
        displaySender = '<span class="draft-label">Draft</span>';
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
        const reportBtn = canReportSpam(email)
          ? `<button class="action-icon-btn btn-row-spam" data-id="${email._id}" title="Report spam">${SPAM_ICON_SVG}</button>`
          : '';
        rowActions = `
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
          <span class="email-subject">${escapeHtml(email.subject)}</span>
          <span class="email-snippet">— ${escapeHtml(email.body.substring(0, 80))}</span>
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

          const result = await updateEmailStatus(email._id, { isStarred: nextState });
          if (!result || !result.email) {
            email.isStarred = previousState;
            star.classList.toggle('starred', previousState);
            star.setAttribute('aria-label', previousState ? 'Unstar email' : 'Star email');
            return;
          }

          email.isStarred = result.email.isStarred;
          fetchEmails(activeFolder);
        };

        star.addEventListener('click', toggleStar);
        star.addEventListener('keydown', toggleStar);
      }

      // Checkbox select event
      const cb = li.querySelector('.email-row-select');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cb.checked) {
          selectedEmailIds.add(cb.getAttribute('data-id'));
        } else {
          selectedEmailIds.delete(cb.getAttribute('data-id'));
        }
        updateDeleteButtonState();
      });

      // Hover row Delete event
      const deleteBtn = li.querySelector('.btn-row-delete');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetId = deleteBtn.getAttribute('data-id');
        if (isPermanentDeleteFolder()) {
          if (confirm('Permanently delete this email?')) {
            await deleteEmailPermanently(targetId);
            fetchEmails(activeFolder);
          }
        } else {
          await updateEmailStatus(targetId, { isTrash: true });
          fetchEmails(activeFolder);
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
    emailDetailsModal.style.display = 'flex';
    emailInfoPanel.hidden = true;
    emailInfoToggle.setAttribute('aria-expanded', 'false');
    const inBin = activeFolder === 'bin';
    const inSpam = activeFolder === 'spam';
    detailsActionRestore.style.display = inBin ? 'inline-flex' : 'none';
    detailsActionDelete.title = inBin ? 'Permanently delete' : inSpam ? 'Delete forever' : 'Move to Bin';
    detailsStarButton.style.display = (inBin || inSpam) ? 'none' : 'inline-flex';

    // Report spam (received mail in Inbox/Starred/All/Bin) or Not spam (inside Spam)
    detailsActionSpam.style.display = canReportSpam(email) ? 'flex' : 'none';
    detailsActionNotSpam.style.display = inSpam ? 'inline-block' : 'none';

    // Explain why the message was flagged
    if (inSpam) {
      const reasons = Array.isArray(email.spamReasons) && email.spamReasons.length > 0
        ? email.spamReasons
        : ['It looks similar to messages that were previously identified as spam'];
      spamWarningReasons.textContent = reasons.join(' • ');
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

    detailsSubject.textContent = email.subject;
    setDetailsStarState(email.isStarred);
    const senderName = email.senderName || email.firstName || (email.sender || '').split('@')[0] || 'Unknown sender';
    const receiverEmail = email.receiver || '';
    const receiverName = email.receiverName ||
      (receiverEmail.toLowerCase() === userEmail.toLowerCase()
        ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
        : receiverEmail.split('@')[0]);
    detailsSenderAvatar.textContent = senderName[0].toUpperCase();
    detailsSenderName.textContent = senderName;
    detailsSenderEmail.textContent = email.sender ? `<${email.sender}>` : '';
    detailsReceiverEmail.textContent = receiverEmail
      ? `to ${receiverEmail.toLowerCase() === userEmail.toLowerCase() ? 'me' : receiverName || receiverEmail}`
      : 'recipient unavailable';
    detailsTimestamp.textContent = formatDetailedTimestamp(email.timestamp);
    detailsContent.textContent = email.body;
    emailInfoFrom.textContent = email.sender
      ? `${senderName} <${email.sender}>`
      : 'Sender details unavailable';
    emailInfoTo.textContent = receiverEmail
      ? `${receiverName || receiverEmail} <${receiverEmail}>`
      : 'Recipient details unavailable';
    emailInfoDate.textContent = formatFullTimestamp(email.timestamp);
    emailInfoSubject.textContent = email.subject || '(No Subject)';
    renderEmailAttachments(email);

    // Automatically mark email as read
    if (!email.isRead) {
      await updateEmailStatus(email._id, { isRead: true });
    }

    // Load any existing extracted tasks for this email
    if (email._id && !email.isDraft && !inBin && !inSpam) {
      fetchEmailTasks(email._id);
    }
  }

  function setDetailsStarState(isStarred) {
    detailsStarIcon.classList.toggle('starred', isStarred);
    detailsStarButton.setAttribute('aria-pressed', String(isStarred));
    detailsStarButton.setAttribute('aria-label', isStarred ? 'Unstar email' : 'Star email');
    detailsStarButton.title = isStarred ? 'Unstar email' : 'Star email';
  }

  function closeDetailsModal() {
    emailDetailsModal.style.display = 'none';
    currentOpenEmail = null;
    emailInfoPanel.hidden = true;
    emailInfoToggle.setAttribute('aria-expanded', 'false');
    attachmentRenderSequence += 1;
    attachmentObjectUrls.forEach(url => URL.revokeObjectURL(url));
    attachmentObjectUrls = [];
    emailAttachmentsList.replaceChildren();
    emailAttachmentsSection.hidden = true;
    spamWarning.style.display = 'none';
    if (emailTasksSection) {
      emailTasksSection.style.display = 'none';
      emailTasksList.innerHTML = '';
    }
    if (btnExtractActions) {
      btnExtractActions.disabled = false;
      btnExtractSpinner.style.display = 'none';
      btnExtractText.textContent = 'Extract Actions';
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

  function renderEmailAttachments(email) {
    clearAttachmentPreviews();
    emailAttachmentsList.replaceChildren();
    const attachments = Array.isArray(email.attachments) ? email.attachments : [];
    emailAttachmentsSection.hidden = attachments.length === 0;
    if (attachments.length === 0) return;

    const renderSequence = attachmentRenderSequence;
    attachments.forEach(attachment => {
      const card = document.createElement('article');
      card.className = 'email-attachment-card';
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.mimeType);
      if (isImage) {
        const preview = document.createElement('img');
        preview.className = 'email-attachment-preview';
        preview.alt = `Preview of ${attachment.filename || 'image attachment'}`;
        preview.src = '';
        card.appendChild(preview);
        let previewRequest;
        try {
          previewRequest = fetch(`${API_BASE}/emails/${email._id}/attachments/${attachment._id}/preview`, {
            headers: tokenHeaders()
          });
        } catch (err) {
          const unavailable = document.createElement('span');
          unavailable.className = 'attachment-preview-unavailable';
          unavailable.textContent = 'Preview unavailable';
          preview.replaceWith(unavailable);
          console.error('Attachment preview failed:', err);
          previewRequest = null;
        }
        if (previewRequest) previewRequest.then(response => {
          if (!response.ok) throw new Error('Image preview is unavailable');
          return response.blob();
        }).then(blob => {
          const objectUrl = URL.createObjectURL(blob);
          if (renderSequence !== attachmentRenderSequence) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          attachmentObjectUrls.push(objectUrl);
          preview.src = objectUrl;
        }).catch(err => {
          if (renderSequence !== attachmentRenderSequence) return;
          const unavailable = document.createElement('span');
          unavailable.className = 'attachment-preview-unavailable';
          unavailable.textContent = 'Preview unavailable';
          preview.replaceWith(unavailable);
          console.error('Attachment preview failed:', err);
        });
      } else {
        const icon = document.createElement('span');
        icon.className = 'attachment-file-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'FILE';
        card.appendChild(icon);
      }

      const metadata = document.createElement('div');
      metadata.className = 'email-attachment-metadata';
      const filename = document.createElement('div');
      filename.className = 'email-attachment-name';
      filename.textContent = attachment.filename || 'Unnamed attachment';
      const fileType = document.createElement('div');
      fileType.className = 'email-attachment-type';
      fileType.textContent = `${attachment.mimeType || 'File'} · ${formatFileSize(attachment.size)}`;
      metadata.append(filename, fileType);
      card.appendChild(metadata);

      const downloadButton = document.createElement('button');
      downloadButton.type = 'button';
      downloadButton.className = 'attachment-download-button';
      downloadButton.textContent = 'Download';
      downloadButton.addEventListener('click', () => downloadAttachment(email, attachment));
      card.appendChild(downloadButton);
      emailAttachmentsList.appendChild(card);
    });
  }

  async function downloadAttachment(email, attachment) {
    try {
      const response = await fetch(
        `${API_BASE}/emails/${email._id}/attachments/${attachment._id}/download`,
        { headers: tokenHeaders() }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'The attachment could not be downloaded.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
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
      if (!isInline && emailObj && typeof emailObj === 'object') {
        const emailSubject = escapeHtml(emailObj.subject || '(No Subject)');
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

        emailRefHtml = `
          <a class="task-email-ref" title="View email (${displayTarget}): ${emailSubject}" data-email-id="${emailObj._id}">
            ✉ ${displayTarget} • ${emailSubject}
          </a>
        `;
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
      const emailRefLink = card.querySelector('.task-email-ref');
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
      // First check cache
      let foundEmail = emailListCache.find(e => e._id === emailId);
      if (!foundEmail) {
        const response = await fetch(`${API_BASE}/emails?email=${encodeURIComponent(userEmail)}&folder=all`);
        if (response.ok) {
          const allEmails = await response.json();
          foundEmail = allEmails.find(e => e._id === emailId);
        }
      }

      if (foundEmail) {
        openEmailDetails(foundEmail);
      } else {
        alert('The original email could not be found or may have been deleted.');
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
  btnDetailsBack.addEventListener('click', () => {
    closeDetailsModal();
    fetchEmails(activeFolder);
  });

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
      if (confirm('Permanently delete this email?')) {
        await deleteEmailPermanently(currentOpenEmail._id);
        closeDetailsModal();
        fetchEmails(activeFolder);
      }
    } else {
      await updateEmailStatus(currentOpenEmail._id, { isTrash: true });
      closeDetailsModal();
      fetchEmails(activeFolder);
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
    if (!currentOpenEmail || activeFolder !== 'bin') return;

    await restoreEmail(currentOpenEmail._id);
    closeDetailsModal();
    fetchEmails(activeFolder);
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
      body: JSON.stringify({ sender: userEmail, receiver, subject, body, isDraft: true })
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
    if (!currentDraftId) return;
    try {
      const response = await fetch(
        `${API_BASE}/emails/${currentDraftId}/attachments/${attachment._id}`,
        { method: 'DELETE', headers: tokenHeaders() }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not remove this attachment.');
      composeAttachments = data.attachments || [];
      renderComposeAttachments();
    } catch (err) {
      console.error('Attachment removal failed:', err);
      alert(err.message || 'Could not remove this attachment.');
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
      const sentRecipients = [];
      const failedRecipients = [];
      const failureMessages = [];
      for (const receiver of recipientEmails) {
        try {
          const response = await fetch(`${API_BASE}/emails`, {
            method: 'POST',
            headers: tokenHeaders({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
              sender: userEmail,
              receiver,
              subject: finalSubject || '(No Subject)',
              body,
              ...(currentDraftId ? { draftId: currentDraftId } : {})
            })
          });

          if (response.ok) {
            sentRecipients.push(receiver);
          } else {
            const data = await response.json().catch(() => ({}));
            failedRecipients.push(receiver);
            failureMessages.push(data.message || `Could not send to ${receiver}.`);
          }
        } catch (err) {
          console.error(`Send email to ${receiver} connection failed:`, err);
          failedRecipients.push(receiver);
          failureMessages.push(err.message || `Could not send to ${receiver}.`);
        }
      }

      if (sentRecipients.length > 0 && failedRecipients.length === 0) {
        // If this message started as a draft, remove the draft now that it was sent
        if (currentDraftId) {
          await deleteEmailPermanently(currentDraftId);
        }
        alert('Email sent successfully!');
        closeComposeModal();
        fetchEmails(activeFolder);
      } else if (sentRecipients.length > 0) {
        chipsContainer.querySelectorAll('.recipient-chip').forEach(chip => chip.remove());
        failedRecipients.forEach(addRecipientChip);
        await saveDraft();
        alert(`Sent to ${sentRecipients.join(', ')}.\nCould not send to ${failedRecipients.join(', ')}. The unsent recipients remain in the draft.\n\n${failureMessages.join('\n')}`);
      } else {
        alert(`Email was not sent. Your compose window and draft have been kept.\n\n${failureMessages.join('\n')}`);
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
    currentDraftId = null;
    composeAttachments = [];
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
          body: JSON.stringify({ sender: userEmail, receiver, subject, body, isDraft: true })
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

    const confirmationMessage = isPermanentDeleteFolder()
      ? `Permanently delete ${selectedEmailIds.size} email(s)?`
      : `Move ${selectedEmailIds.size} email(s) to Bin?`;
    if (confirm(confirmationMessage)) {
      const promises = Array.from(selectedEmailIds).map(id => {
        if (isPermanentDeleteFolder()) {
          return deleteEmailPermanently(id);
        } else {
          return updateEmailStatus(id, { isTrash: true });
        }
      });

      await Promise.all(promises);
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();
      fetchEmails(activeFolder);
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
    if (hasSelection) {
      deleteActionBarBtn.removeAttribute('disabled');
    } else {
      deleteActionBarBtn.setAttribute('disabled', 'true');
    }
    restoreActionBarBtn.disabled = !hasSelection;
    restoreActionBarBtn.style.display = activeFolder === 'bin' ? 'flex' : 'none';
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
    if (searching) {
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
  fetchEmails(activeFolder);
  refreshInboxBadge();
  refreshActionsBadge();
  refreshSpamBadge();
  updateDeleteButtonState(); // sets the initial visibility of Report spam / Not spam buttons

});
