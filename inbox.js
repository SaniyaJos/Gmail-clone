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
  const userEmail = currentUser.email;

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

  // Details Modal Elements
  const emailDetailsModal = document.getElementById('email-details-modal');
  const btnDetailsBack = document.getElementById('btn-details-back');
  const detailsActionRestore = document.getElementById('details-action-restore');
  const detailsActionDelete = document.getElementById('details-action-delete');
  const detailsStarButton = document.getElementById('details-star-button');
  const detailsStarIcon = detailsStarButton.querySelector('.details-star-icon');
  const detailsSubject = document.getElementById('details-subject');
  const detailsSenderAvatar = document.getElementById('details-sender-avatar');
  const detailsSenderName = document.getElementById('details-sender-name');
  const detailsSenderEmail = document.getElementById('details-sender-email');
  const detailsReceiverEmail = document.getElementById('details-receiver-email');
  const detailsTimestamp = document.getElementById('details-timestamp');
  const detailsContent = document.getElementById('details-content');

  // ==========================================
  // 4. API SERVICE HELPERS
  // ==========================================

  // Fetch emails from server based on folder and search query
  async function fetchEmails(folder) {
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
  // 5. EMAIL LIST RENDERING
  // ==========================================

  function renderEmailList(emails) {
    emailListUl.innerHTML = '';

    // Update Badge counts for Inbox and Drafts
    if (!activeSearchQuery) updateFolderBadges(emails);

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
      let displaySender = email.sender === userEmail ? `To: ${email.receiver}` : email.firstName || email.sender.split('@')[0];
      if (email.isDraft) {
        displaySender = '<span class="draft-label">Draft</span>';
      }

      // Star control (hidden when in Bin)
      const starClass = email.isStarred ? 'starred' : '';
      const starControl = activeFolder === 'bin'
        ? ''
        : `<img src="images/star-regular-full.svg" alt="Star" role="button" tabindex="0" aria-label="${email.isStarred ? 'Unstar email' : 'Star email'}" class="email-row-star ${starClass}" data-id="${email._id}">`;

      // Row hover action buttons (Restore + Delete in Bin; Move to Bin otherwise)
      const rowActions = activeFolder === 'bin'
        ? `
          <button class="action-icon-btn btn-row-restore" data-id="${email._id}" title="Restore">
            <span class="restore-icon" aria-hidden="true">&#8630;</span>
          </button>
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Permanently delete">
            <img src="images/trash-can-regular-full.svg" alt="Delete permanently" class="row-action-icon-img">
          </button>
        `
        : `
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Move to Bin">
            <img src="images/trash-can-regular-full.svg" alt="Move to Bin" class="row-action-icon-img">
          </button>
        `;

      li.innerHTML = `
        <input type="checkbox" class="email-row-select" data-id="${email._id}" aria-label="Select mail">
        ${starControl}
        <div class="email-sender">${displaySender}</div>
        <div class="email-content">
          <span class="email-subject">${email.subject}</span>
          <span class="email-snippet">— ${email.body.substring(0, 80)}</span>
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
        if (activeFolder === 'bin') {
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
    detailsActionRestore.style.display = activeFolder === 'bin' ? 'inline-flex' : 'none';
    detailsActionDelete.title = activeFolder === 'bin' ? 'Permanently delete' : 'Move to Bin';
    detailsStarButton.style.display = activeFolder === 'bin' ? 'none' : 'inline-flex';

    detailsSubject.textContent = email.subject;
    setDetailsStarState(email.isStarred);
    const senderName = email.firstName || email.sender.split('@')[0];
    detailsSenderAvatar.textContent = senderName[0].toUpperCase();
    detailsSenderName.textContent = senderName;
    detailsSenderEmail.textContent = `<${email.sender}>`;
    detailsReceiverEmail.textContent = `to me ▾`;
    detailsTimestamp.textContent = formatDetailedTimestamp(email.timestamp);
    detailsContent.textContent = email.body;

    // Automatically mark email as read
    if (!email.isRead) {
      await updateEmailStatus(email._id, { isRead: true });
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
  }

  // Details Modal: Back button
  btnDetailsBack.addEventListener('click', () => {
    closeDetailsModal();
    fetchEmails(activeFolder);
  });

  // Details Modal: Star button toggle
  detailsStarButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!currentOpenEmail || activeFolder === 'bin') return;

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

    if (activeFolder === 'bin') {
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
    await saveDraft();
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

  // Check recipient on Enter key
  emailToInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const email = emailToInput.value.trim().toLowerCase();
      if (!email) return;

      if (!email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
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

  // Submit Compose Form (Send Email)
  composeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const toVal = emailToInput.value.trim().toLowerCase();

    // If typed without pressing enter, verify now
    if (toVal) {
      if (!toVal.includes('@')) {
        alert('Please enter a valid receiver email address.');
        return;
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
          } else {
            alert('User Not Found');
            return;
          }
        } else {
          alert('Error checking user availability.');
          return;
        }
      } catch (err) {
        console.error('Check email availability failed on submit:', err);
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

    let anySuccess = false;
    for (const receiver of recipientEmails) {
      try {
        const response = await fetch(`${API_BASE}/emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: userEmail,
            receiver,
            subject,
            body
          })
        });

        if (response.ok) {
          anySuccess = true;
        }
      } catch (err) {
        console.error(`Send email to ${receiver} connection failed:`, err);
      }
    }

    if (anySuccess) {
      // If this message started as a draft, remove the draft now that it was sent
      if (currentDraftId) {
        await deleteEmailPermanently(currentDraftId);
      }
      alert('Email sent successfully!');
      closeComposeModal();
      fetchEmails(activeFolder);
    } else {
      alert(`Connection Offline!\n\nEmail sent (Simulated):\nTo: ${recipientEmails.join(', ')}\nSubject: ${subject}`);
      closeComposeModal();
    }
  });

  function closeComposeModal() {
    currentDraftId = null;
    composeModal.style.display = 'none';
    composeForm.reset();
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
    const isEmpty = !receiver && !subject && !body.trim();

    try {
      if (isEmpty) {
        if (currentDraftId) await deleteEmailPermanently(currentDraftId);
        return;
      }

      if (currentDraftId) {
        const response = await fetch(`${API_BASE}/emails/${currentDraftId}/draft`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiver, subject, body })
        });
        if (!response.ok) throw new Error('Failed to update draft');
      } else {
        const response = await fetch(`${API_BASE}/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: userEmail, receiver, subject, body, isDraft: true })
        });
        if (!response.ok) throw new Error('Failed to save draft');
        const data = await response.json();
        currentDraftId = data.email._id;
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  }

  // Open an existing saved draft inside the compose modal to continue editing
  async function openDraftInCompose(draft) {
    // If another message is already open, keep it as draft first
    if (composeModal.style.display === 'flex') {
      await saveDraft();
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

  // Refresh toolbar button
  refreshActionBarBtn.addEventListener('click', () => {
    fetchEmails(activeFolder);
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

    const confirmationMessage = activeFolder === 'bin'
      ? `Permanently delete ${selectedEmailIds.size} email(s)?`
      : `Move ${selectedEmailIds.size} email(s) to Bin?`;
    if (confirm(confirmationMessage)) {
      const promises = Array.from(selectedEmailIds).map(id => {
        if (activeFolder === 'bin') {
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
    deleteActionBarBtn.title = activeFolder === 'bin' ? 'Permanently delete' : 'Move to Bin';
  }

  // Display empty folder placeholder
  function showEmptyState(folder, searching = false) {
    emptyStateView.style.display = 'flex';
    mailListWrapper.style.display = 'none';

    const title = emptyStateView.querySelector('.empty-title');
    const subtitle = emptyStateView.querySelector('.empty-subtitle');

    if (searching) {
      title.textContent = 'No matching messages';
      subtitle.textContent = 'Try different search terms or check the spelling.';
      return;
    }

    switch (folder) {
      case 'inbox':
        title.textContent = 'Your inbox is empty';
        subtitle.textContent = "Mails that don't appear in other tabs will be shown here.";
        break;
      case 'starred':
        title.textContent = 'No starred messages';
        subtitle.textContent = 'Stars let you give messages a special status to make them easier to find.';
        break;
      case 'sent':
        title.textContent = 'No sent messages';
        subtitle.textContent = 'Send emails to your classmates and review progress here.';
        break;
      case 'drafts':
        title.textContent = "You don't have any saved drafts.";
        subtitle.textContent = "Saving a draft allows you to keep a message you aren't ready to send yet.";
        break;
      case 'bin':
        title.textContent = 'No messages in Bin';
        subtitle.textContent = 'Deleted emails will go here and can be permanently purged.';
        break;
      case 'all':
      default:
        title.textContent = 'No mail found';
        subtitle.textContent = 'Your search or selection returned zero documents in the database.';
        break;
    }
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

});