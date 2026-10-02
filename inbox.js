/* JavaScript for Gmail Clone Inbox Dashboard */

document.addEventListener('DOMContentLoaded', () => {
  // Check user authentication session
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
    
    // Populate Dropdown Modal
    if (dropdownAvatar && dropdownName && dropdownEmail) {
      dropdownAvatar.textContent = currentUser.firstName.charAt(0).toUpperCase();
      dropdownName.textContent = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
      dropdownEmail.textContent = userEmail;
    }

    // Toggle dropdown on avatar click
    headerAvatar.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent document click from immediately closing it
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

  // State Management
  let activeFolder = 'inbox';
  let activeSearchQuery = '';
  let searchDebounceTimer;
  let emailFetchSequence = 0;
  let emailListCache = [];
  let selectedEmailIds = new Set();
  let currentOpenEmail = null;

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const emptyStateView = document.getElementById('empty-state-view');
  const mailListWrapper = document.getElementById('mail-list-wrapper');
  const emailListUl = document.getElementById('email-list');
  const mailCountRange = document.getElementById('mail-count-range');
  const searchInput = document.getElementById('search-input');
  const filterToggle = document.getElementById('filter-toggle');
  const searchFilterPanel = document.getElementById('search-filter-panel');
  const searchFilterForm = document.getElementById('search-filter-panel');
  const selectAllCheckbox = document.getElementById('select-all');
  const deleteActionBarBtn = document.getElementById('action-delete');
  const refreshActionBarBtn = document.getElementById('action-refresh');

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

  // Sidebar Toggle Elements
  const sidebarToggleBtn = document.querySelector('.sidebar-toggle-btn');
  const sidebar = document.querySelector('.app-sidebar');

  sidebarToggleBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      document.querySelector('.app-container').classList.remove('collapsed');
    } else {
      document.querySelector('.app-container').classList.toggle('collapsed');
      sidebar.classList.remove('open');
    }
  });

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(applySearch, 300);
  });

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

  searchInput.addEventListener('search', () => {
    if (!searchInput.value.trim() && activeSearchQuery) {
      activeSearchQuery = '';
      applySearch();
    }
  });

  filterToggle.addEventListener('click', () => {
    const isOpen = !searchFilterPanel.hidden;
    searchFilterPanel.hidden = isOpen;
    filterToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  searchFilterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const criteria = [
      ['filter-from', 'from'],
      ['filter-to', 'to'],
      ['filter-subject', 'subject'],
      ['filter-words', ''],
      ['filter-exclude', '-']
    ];
    const terms = criteria.flatMap(([id, operator]) => {
      const value = document.getElementById(id).value.trim();
      if (!value) return [];
      const quotedValue = `"${value.replace(/"/g, '')}"`;
      return [operator === '-'
        ? `-${quotedValue}`
        : `${operator ? `${operator}:` : ''}${quotedValue}`];
    });

    searchInput.value = terms.join(' ');
    window.clearTimeout(searchDebounceTimer);
    searchFilterPanel.hidden = true;
    filterToggle.setAttribute('aria-expanded', 'false');
    applySearch();
  });

  document.getElementById('filter-clear').addEventListener('click', () => {
    searchFilterForm.reset();
    searchInput.value = '';
    window.clearTimeout(searchDebounceTimer);
    applySearch();
  });

  document.addEventListener('click', (event) => {
    if (!searchFilterPanel.hidden && !searchFilterPanel.contains(event.target) && !filterToggle.contains(event.target)) {
      searchFilterPanel.hidden = true;
      filterToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Init App
  fetchEmails(activeFolder);

  // Folder switching handlers
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Clear selections
      selectedEmailIds.clear();
      selectAllCheckbox.checked = false;
      updateDeleteButtonState();

      // Toggle active states
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      activeFolder = item.getAttribute('data-folder');
      
      // Close details modal if open
      closeDetailsModal();

      fetchEmails(activeFolder);

      // Close sidebar in mobile view
      sidebar.classList.remove('open');
    });
  });

  // Action Buttons
  refreshActionBarBtn.addEventListener('click', () => {
    fetchEmails(activeFolder);
  });

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

  deleteActionBarBtn.addEventListener('click', async () => {
    if (selectedEmailIds.size === 0) return;

    if (confirm(`Move ${selectedEmailIds.size} email(s) to Bin?`)) {
      const promises = Array.from(selectedEmailIds).map(id => {
        if (activeFolder === 'bin') {
          // If already in Bin, delete permanently
          return deleteEmailPermanently(id);
        } else {
          // Otherwise move to Bin
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

  // Core API Fetch function
  async function fetchEmails(folder) {
    const requestSequence = ++emailFetchSequence;
    try {
      const params = new URLSearchParams({ email: userEmail, folder });
      if (activeSearchQuery) params.set('q', activeSearchQuery);
      const response = await fetch(`http://localhost:5000/api/emails?${params}`);
      if (!response.ok) {
        throw new Error('Failed to retrieve emails');
      }
      const data = await response.json();
      if (requestSequence !== emailFetchSequence) return;
      emailListCache = data;
      renderEmailList(data);
    } catch (err) {
      console.error('Error fetching emails:', err);
    }
  }

  function applySearch() {
    activeSearchQuery = searchInput.value.trim();
    selectedEmailIds.clear();
    selectAllCheckbox.checked = false;
    updateDeleteButtonState();
    closeDetailsModal();
    fetchEmails(activeFolder);
  }

  // Render Email List inside UI
  function renderEmailList(emails) {
    emailListUl.innerHTML = '';
    
    // Update Badge counts for Inbox and Drafts
    if (!activeSearchQuery) updateFolderBadges(emails);

    if (emails.length === 0) {
      showEmptyState(activeFolder, Boolean(activeSearchQuery));
      mailCountRange.textContent = '0-0 of 0';
      return;
    }

    // Hide empty state, display list wrapper
    emptyStateView.style.display = 'none';
    mailListWrapper.style.display = 'block';

    mailCountRange.textContent = `1-${emails.length} of ${emails.length}`;

    emails.forEach(email => {
      const li = document.createElement('li');
      li.className = `email-row ${email.isRead ? 'read' : 'unread'}`;
      li.setAttribute('data-id', email._id);

      const formattedDate = formatTimestamp(email.timestamp);

      // Determine sender display: if user is sender, display receiver email
      let displaySender = email.sender === userEmail ? `To: ${email.receiver}` : email.firstName || email.sender.split('@')[0];

      // Show the current starred state
      const starClass = email.isStarred ? 'starred' : '';

      li.innerHTML = `
        <input type="checkbox" class="email-row-select" data-id="${email._id}" aria-label="Select mail">
        <img src="images/star-regular-full.svg" alt="Star" role="button" tabindex="0" aria-label="${email.isStarred ? 'Unstar email' : 'Star email'}" class="email-row-star ${starClass}" data-id="${email._id}">
        <div class="email-sender">${displaySender}</div>
        <div class="email-content">
          <span class="email-subject">${email.subject}</span>
          <span class="email-snippet">— ${email.body.substring(0, 80)}</span>
        </div>
        <div class="email-date">${formattedDate}</div>
        <div class="email-row-actions">
          <button class="action-icon-btn btn-row-delete" data-id="${email._id}" title="Move to Bin">
            <img src="images/trash-can-regular-full.svg" alt="Delete" class="row-action-icon-img">
          </button>
        </div>
      `;

      // Toggle the star without triggering the row's open-email action
      const star = li.querySelector('.email-row-star');
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

      // Select Checkbox Event
      const cb = li.querySelector('.email-row-select');
      cb.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent opening detailed email view
        if (cb.checked) {
          selectedEmailIds.add(cb.getAttribute('data-id'));
        } else {
          selectedEmailIds.delete(cb.getAttribute('data-id'));
        }
        updateDeleteButtonState();
      });

      // Hover Action Delete Event
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

      // Open Email detailed overlay on row click
      li.addEventListener('click', () => {
        openEmailDetails(email);
      });

      emailListUl.appendChild(li);
    });
  }

  // Open Details panel overlay
  async function openEmailDetails(email) {
    currentOpenEmail = email;
    emailDetailsModal.style.display = 'flex';

    detailsSubject.textContent = email.subject;
    setDetailsStarState(email.isStarred);
    const senderName = email.firstName || email.sender.split('@')[0];
    detailsSenderAvatar.textContent = senderName[0].toUpperCase();
    detailsSenderName.textContent = senderName;
    detailsSenderEmail.textContent = `<${email.sender}>`;
    detailsReceiverEmail.textContent = `to me ▾`;
    detailsTimestamp.textContent = formatDetailedTimestamp(email.timestamp);
    detailsContent.textContent = email.body;

    // Call patch API to mark read
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

  // Details Modal close and Delete handlers
  btnDetailsBack.addEventListener('click', () => {
    closeDetailsModal();
    fetchEmails(activeFolder);
  });

  detailsStarButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!currentOpenEmail) return;

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

  function closeDetailsModal() {
    emailDetailsModal.style.display = 'none';
    currentOpenEmail = null;
  }

  // Compose Modal Toggle Clicks
  composeBtn.addEventListener('click', () => {
    composeModal.classList.remove('maximized');
    composeModal.classList.remove('minimized');
    composeMaximizeBtn.textContent = '⤢';
    composeMaximizeBtn.title = 'Maximize';
    composeModal.style.display = 'flex';
    emailToInput.focus();
  });

  composeCloseBtn.addEventListener('click', () => {
    closeComposeModal();
  });

  composeMinimizeBtn.addEventListener('click', () => {
    composeModal.classList.remove('maximized');
    composeModal.classList.toggle('minimized');
  });

  composeMaximizeBtn.addEventListener('click', () => {
    composeModal.classList.remove('minimized');
    composeModal.classList.toggle('maximized');
    if (composeModal.classList.contains('maximized')) {
      composeMaximizeBtn.textContent = '⤡'; // restore symbol
      composeMaximizeBtn.title = 'Restore';
    } else {
      composeMaximizeBtn.textContent = '⤢'; // maximize symbol
      composeMaximizeBtn.title = 'Maximize';
    }
  });

  composeDiscardBtn.addEventListener('click', () => {
    closeComposeModal();
  });

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
        const response = await fetch('http://localhost:5000/api/check-username', {
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
    
    // If they typed something and hit submit without hitting Enter, check it now
    if (toVal) {
      if (!toVal.includes('@')) {
        alert('Please enter a valid receiver email address.');
        return;
      }
      
      try {
        const response = await fetch('http://localhost:5000/api/check-username', {
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
        const response = await fetch('http://localhost:5000/api/emails', {
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
      alert('Email sent successfully!');
      closeComposeModal();
      fetchEmails(activeFolder);
    } else {
      // Offline simulation fallback: if all POSTs failed (or connection failed)
      alert(`Connection Offline!\n\nEmail sent (Simulated):\nTo: ${recipientEmails.join(', ')}\nSubject: ${subject}`);
      closeComposeModal();
    }
  });

  function closeComposeModal() {
    composeModal.style.display = 'none';
    composeForm.reset();
    if (chipsContainer) {
      const chips = chipsContainer.querySelectorAll('.recipient-chip');
      chips.forEach(chip => chip.remove());
    }
  }

  // Update Status Flags via PATCH request
  async function updateEmailStatus(id, updateFields) {
    try {
      const response = await fetch(`http://localhost:5000/api/emails/${id}`, {
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

  // Delete Permanently via DELETE request
  async function deleteEmailPermanently(id) {
    try {
      await fetch(`http://localhost:5000/api/emails/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting email permanently:', err);
    }
  }

  // UI state change helpers
  function updateDeleteButtonState() {
    if (selectedEmailIds.size > 0) {
      deleteActionBarBtn.removeAttribute('disabled');
    } else {
      deleteActionBarBtn.setAttribute('disabled', 'true');
    }
  }

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

  function formatTimestamp(timestampStr) {
    const date = new Date(timestampStr);
    const now = new Date();
    
    // If today, show time (e.g. 5:10 PM)
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Otherwise show date (e.g. Aug 9)
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

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

});
