import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailApi, labelApi, taskApi, authApi } from '../services/api';
import { groupEmailsByThread } from '../utils/formatters';

import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MailActionBar from '../components/mail/MailActionBar';
import FolderBanner from '../components/mail/FolderBanner';
import EmailList from '../components/mail/EmailList';
import EmptyState from '../components/mail/EmptyState';
import EmailDetailsModal from '../components/mail/EmailDetailsModal';
import ComposeModal from '../components/compose/ComposeModal';
import ActionsPanel from '../components/tasks/ActionsPanel';
import ToastSnackbar from '../components/common/ToastSnackbar';
import ConfirmDialog from '../components/common/ConfirmDialog';
import InboxGuide from '../components/guide/InboxGuide';

import '../styles/inbox.css';
import '../styles/inbox-guide.css';

export default function InboxPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      navigate('/signin');
    }
  }, [isAuthenticated, user, navigate]);

  // Main UI State with reload persistence via URL query params & localStorage
  const [activeFolder, setActiveFolder] = useState(() => {
    const param = searchParams.get('folder');
    if (param) return param;
    const saved = localStorage.getItem('inboxflow_active_folder');
    if (saved) return saved;
    return 'inbox';
  });

  const [activeLabelId, setActiveLabelId] = useState(() => {
    const param = searchParams.get('label');
    if (param) return param;
    const saved = localStorage.getItem('inboxflow_active_label');
    if (saved) return saved;
    return null;
  });

  // Sync active view whenever browser forward/back or searchParams change
  useEffect(() => {
    const paramFolder = searchParams.get('folder');
    const paramLabel = searchParams.get('label');
    if (paramFolder && paramFolder !== activeFolder) {
      setActiveFolder(paramFolder);
      localStorage.setItem('inboxflow_active_folder', paramFolder);
    }
    if (paramLabel !== undefined && paramLabel !== activeLabelId) {
      setActiveLabelId(paramLabel || null);
      if (paramLabel) localStorage.setItem('inboxflow_active_label', paramLabel);
      else localStorage.removeItem('inboxflow_active_label');
    }
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setIsMobileSidebarOpen((prev) => !prev);
      setIsSidebarCollapsed(false);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
      setIsMobileSidebarOpen(false);
    }
  };

  // Email and Thread Data
  const [rawEmails, setRawEmails] = useState([]);
  const [selectedEmailIds, setSelectedEmailIds] = useState(new Set());
  const [currentOpenEmail, setCurrentOpenEmail] = useState(null);
  const [threadEmails, setThreadEmails] = useState([]);
  const [emailTasks, setEmailTasks] = useState([]);
  const [isExtractingActions, setIsExtractingActions] = useState(false);

  // Set of trashed email IDs (for instant reflection in tasks / My Actions)
  const [trashedEmailIds, setTrashedEmailIds] = useState(new Set());

  // Counts & Labels for all folders (inbox, starred, sent, drafts, actions, spam, bin, all)
  const [counts, setCounts] = useState({
    inbox: 0,
    starred: 0,
    sent: 0,
    drafts: 0,
    actions: 0,
    spam: 0,
    bin: 0,
    all: 0
  });
  const [customLabels, setCustomLabels] = useState([]);
  const [labelFeedback, setLabelFeedback] = useState(null);

  // Actions Panel Tasks
  const [tasks, setTasks] = useState([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState(null);

  // Toast & Confirm State
  const [toast, setToast] = useState({ visible: false, message: '', actionText: '', onAction: null });
  const [confirmEmptyDialog, setConfirmEmptyDialog] = useState({ isOpen: false, folder: '' });
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState({
    isOpen: false,
    ids: [],
    isTask: false,
    taskId: null,
    isPermanentFolder: false,
    closeDetails: false
  });

  const toastTimerRef = useRef(null);

  const showToast = useCallback(({ message, actionText = 'Undo', onAction = null, duration = 8000 }) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message, actionText, onAction });
    if (duration > 0) {
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, duration);
    }
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Debounce search typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Folder counts across folders (inbox unread, drafts total, spam unread, all mail inbox+sent, actions total)
  const loadCounts = useCallback(async () => {
    if (!user?.email) return;
    try {
      const [countsRes, tasksRes] = await Promise.all([
        emailApi.getCounts().catch(() => ({})),
        taskApi.getTasks({ userEmail: user.email }).catch(() => [])
      ]);

      setCounts({
        inbox: countsRes?.inbox ?? 0,
        starred: 0,
        sent: 0,
        drafts: countsRes?.drafts ?? 0,
        spam: countsRes?.spam ?? countsRes?.spamUnread ?? 0,
        bin: 0,
        all: countsRes?.all ?? 0,
        actions: tasksRes?.length || 0
      });
    } catch (err) {
      console.error('Error loading counts:', err);
    }
  }, [user?.email]);

  // Load Labels
  const loadLabels = useCallback(async () => {
    try {
      const labels = await labelApi.getLabels();
      setCustomLabels(labels || []);
    } catch (err) {
      console.error('Error loading labels:', err);
    }
  }, []);

  // Load Emails
  const loadEmails = useCallback(async () => {
    if (!user?.email || activeFolder === 'actions') return;

    try {
      const data = await emailApi.getEmails({
        email: user.email,
        folder: activeFolder,
        q: debouncedSearch,
        labelId: activeLabelId
      });
      setRawEmails(data || []);

      // Update inbox unread count
      if (activeFolder === 'inbox' && !debouncedSearch && !activeLabelId) {
        const unread = (data || []).filter((m) => !m.isRead).length;
        setCounts((prev) => ({ ...prev, inbox: unread }));
      }
    } catch (err) {
      console.error('Error loading emails:', err);
    }
  }, [user?.email, activeFolder, debouncedSearch, activeLabelId]);

  // Load Tasks for Actions view
  const loadTasks = useCallback(async () => {
    if (!user?.email) return;
    setIsTasksLoading(true);
    try {
      const data = await taskApi.getTasks({ userEmail: user.email });
      setTasks(data || []);
      setCounts((prev) => ({ ...prev, actions: data?.length || 0 }));
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setIsTasksLoading(false);
    }
  }, [user?.email]);

  // Trigger loads on view changes
  useEffect(() => {
    loadCounts();
    loadLabels();
  }, [loadCounts, loadLabels]);

  useEffect(() => {
    setSelectedEmailIds(new Set());
    if (activeFolder === 'actions') {
      loadTasks();
    } else {
      loadEmails();
    }
  }, [activeFolder, activeLabelId, debouncedSearch, loadEmails, loadTasks]);

  // Group emails into threads
  const groupedEmails = groupEmailsByThread(rawEmails, activeFolder, user?.email);

  // Folder navigation handler
  const handleSelectFolder = (folderId) => {
    setActiveLabelId(null);
    setActiveFolder(folderId);
    setCurrentOpenEmail(null);
    setIsMobileSidebarOpen(false);
    localStorage.setItem('inboxflow_active_folder', folderId);
    localStorage.removeItem('inboxflow_active_label');
    setSearchParams({ folder: folderId });
  };

  // Label navigation handler
  const handleSelectLabel = (labelId) => {
    setActiveLabelId(labelId);
    setActiveFolder('all');
    setCurrentOpenEmail(null);
    setIsMobileSidebarOpen(false);
    localStorage.setItem('inboxflow_active_folder', 'all');
    localStorage.setItem('inboxflow_active_label', labelId);
    setSearchParams({ folder: 'all', label: labelId });
  };

  // Selection handlers
  const handleToggleSelect = (ids, checked) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(String(id));
        else next.delete(String(id));
      });
      return next;
    });
  };

  const handleToggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedEmailIds(new Set());
      return;
    }
    const allIds = groupedEmails.flatMap((e) =>
      e.threadEmailIds?.length > 0 ? e.threadEmailIds : [e._id]
    );
    setSelectedEmailIds(new Set(allIds.map(String)));
  };

  // Star toggle with instant counts update
  const handleToggleStar = async (email) => {
    const nextStarred = !email.isStarred;
    const targetIds = email.threadEmailIds?.length > 0 ? email.threadEmailIds : [email._id];

    // Optimistically update counts
    setCounts((prev) => ({
      ...prev,
      starred: nextStarred ? prev.starred + 1 : Math.max(0, prev.starred - 1)
    }));

    // Optimistically update emails
    setRawEmails((prev) =>
      prev.map((e) => (targetIds.includes(e._id) ? { ...e, isStarred: nextStarred } : e))
    );
    if (currentOpenEmail) {
      setCurrentOpenEmail((prev) => ({ ...prev, isStarred: nextStarred }));
      setThreadEmails((prev) =>
        prev.map((e) => (targetIds.includes(e._id) ? { ...e, isStarred: nextStarred } : e))
      );
    }

    try {
      await Promise.all(targetIds.map((id) => emailApi.updateEmail(id, { isStarred: nextStarred })));
      loadEmails();
      loadCounts();
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  // Open email details or draft in compose
  const handleOpenEmail = async (email) => {
    if (activeFolder === 'drafts' && email.isDraft) {
      setComposeInitialData({
        draftId: email._id,
        recipients: email.receiver
          ? email.receiver.split(',').map((r) => r.trim()).filter(Boolean)
          : [],
        subject: email.subject === '(No Subject)' ? '' : email.subject,
        body: email.body || '',
        attachments: email.attachments || [],
        title: 'Edit Message'
      });
      setIsComposeOpen(true);
      return;
    }

    // Instantly decrement unread count if opening unread email
    if (!email.isRead) {
      setCounts((prev) => ({ ...prev, inbox: Math.max(0, prev.inbox - 1) }));
    }

    setCurrentOpenEmail(email);

    // Mark as read optimistically
    const targetIds = email.threadEmailIds?.length > 0 ? email.threadEmailIds : [email._id];
    setRawEmails((prev) =>
      prev.map((e) => (targetIds.includes(e._id) ? { ...e, isRead: true } : e))
    );

    // Load thread and tasks
    try {
      const [threadRes, tasksRes] = await Promise.all([
        emailApi.getEmailThread(email._id).catch(() => ({ emails: [email] })),
        taskApi.getTasks({ userEmail: user.email, emailId: email._id }).catch(() => [])
      ]);
      setThreadEmails(threadRes.emails || [email]);
      setEmailTasks(tasksRes || []);
      await Promise.all(targetIds.map((id) => emailApi.updateEmail(id, { isRead: true })));
      loadCounts();
    } catch (err) {
      console.error('Error opening email details:', err);
    }
  };

  // Move emails to Bin with immediate reflection in My Actions and all folder counts
  const moveEmailsToBin = async (ids, customMsg = null) => {
    const targetIds = Array.isArray(ids) ? ids : [ids];
    if (targetIds.length === 0) return;

    // Record trashed ID set so My Actions displays [In Bin] immediately
    setTrashedEmailIds((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(String(id)));
      return next;
    });

    // Optimistically update tasks state immediately
    setTasks((prev) =>
      prev.map((t) => {
        const tid = typeof t.emailId === 'object' && t.emailId?._id
          ? String(t.emailId._id)
          : (t.emailId ? String(t.emailId) : null);
        if (tid && targetIds.some((id) => String(id) === tid)) {
          return {
            ...t,
            emailId: typeof t.emailId === 'object'
              ? { ...t.emailId, isTrash: true }
              : { _id: t.emailId, isTrash: true, subject: t.emailSubject }
          };
        }
        return t;
      })
    );
    setEmailTasks((prev) =>
      prev.map((t) => {
        const tid = typeof t.emailId === 'object' && t.emailId?._id
          ? String(t.emailId._id)
          : (t.emailId ? String(t.emailId) : null);
        if (tid && targetIds.some((id) => String(id) === tid)) {
          return {
            ...t,
            emailId: typeof t.emailId === 'object'
              ? { ...t.emailId, isTrash: true }
              : { _id: t.emailId, isTrash: true, subject: t.emailSubject }
          };
        }
        return t;
      })
    );

    // Instant optimistic counts update across all folders
    const unreadCountInInbox = rawEmails.filter(
      (e) => targetIds.includes(e._id) && !e.isRead && (activeFolder === 'inbox' || !e.isTrash)
    ).length;
    const starredCount = rawEmails.filter((e) => targetIds.includes(e._id) && e.isStarred).length;

    setCounts((prev) => ({
      ...prev,
      inbox: unreadCountInInbox > 0 ? Math.max(0, prev.inbox - unreadCountInInbox) : prev.inbox,
      drafts: activeFolder === 'drafts' ? Math.max(0, prev.drafts - targetIds.length) : prev.drafts,
      starred: starredCount > 0 ? Math.max(0, prev.starred - starredCount) : prev.starred,
      sent: activeFolder === 'sent' ? Math.max(0, prev.sent - targetIds.length) : prev.sent,
      all: Math.max(0, prev.all - targetIds.length),
      bin: prev.bin + targetIds.length
    }));

    setRawEmails((prev) => prev.filter((e) => !targetIds.includes(e._id)));

    try {
      await Promise.all(targetIds.map((id) => emailApi.updateEmail(id, { isTrash: true })));
      loadEmails();
      loadCounts();

      const msg =
        customMsg ||
        (targetIds.length > 1
          ? `${targetIds.length} conversations moved to Bin.`
          : 'Conversation moved to Bin.');

      showToast({
        message: msg,
        actionText: 'Undo',
        duration: 8000,
        onAction: async () => {
          setTrashedEmailIds((prev) => {
            const next = new Set(prev);
            targetIds.forEach((id) => next.delete(String(id)));
            return next;
          });
          setTasks((prev) =>
            prev.map((t) => {
              const tid = typeof t.emailId === 'object' && t.emailId?._id
                ? String(t.emailId._id)
                : (t.emailId ? String(t.emailId) : null);
              if (tid && targetIds.some((id) => String(id) === tid)) {
                return {
                  ...t,
                  emailId: typeof t.emailId === 'object'
                    ? { ...t.emailId, isTrash: false }
                    : { _id: t.emailId, isTrash: false, subject: t.emailSubject }
                };
              }
              return t;
            })
          );
          await Promise.all(targetIds.map((id) => emailApi.updateEmail(id, { isTrash: false })));
          loadEmails();
          loadCounts();
          showToast({ message: 'Action undone.', duration: 4000 });
        }
      });
    } catch (err) {
      console.error('Error moving to bin:', err);
    }
  };

  // Permanently delete emails
  const deleteEmailsPermanently = async (ids) => {
    const targetIds = Array.isArray(ids) ? ids : [ids];
    if (targetIds.length === 0) return;

    // Optimistically update counts
    setCounts((prev) => ({
      ...prev,
      bin: activeFolder === 'bin' ? Math.max(0, prev.bin - targetIds.length) : prev.bin,
      spam: activeFolder === 'spam' ? Math.max(0, prev.spam - targetIds.length) : prev.spam,
      all: Math.max(0, prev.all - targetIds.length)
    }));

    // In tasks, clear email reference if email permanently deleted
    setTasks((prev) =>
      prev.map((t) => {
        const tid = typeof t.emailId === 'object' && t.emailId?._id
          ? String(t.emailId._id)
          : (t.emailId ? String(t.emailId) : null);
        if (tid && targetIds.some((id) => String(id) === tid)) {
          return { ...t, emailId: null };
        }
        return t;
      })
    );

    setRawEmails((prev) => prev.filter((e) => !targetIds.includes(e._id)));

    try {
      await Promise.all(targetIds.map((id) => emailApi.deleteEmail(id)));
      loadEmails();
      loadCounts();
      showToast({ message: 'Deleted permanently.', duration: 4000 });
    } catch (err) {
      console.error('Error deleting permanently:', err);
    }
  };

  // Toolbar delete handler - triggers popup ONLY inside the trash bin
  const handleDeleteSelected = () => {
    const ids = Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    if (activeFolder === 'bin') {
      setConfirmDeleteDialog({
        isOpen: true,
        ids,
        closeDetails: false
      });
    } else {
      moveEmailsToBin(ids);
      setSelectedEmailIds(new Set());
    }
  };

  // Toolbar restore handler
  const handleRestoreSelected = async () => {
    const ids = Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    setTrashedEmailIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(String(id)));
      return next;
    });

    setTasks((prev) =>
      prev.map((t) => {
        const tid = typeof t.emailId === 'object' && t.emailId?._id
          ? String(t.emailId._id)
          : (t.emailId ? String(t.emailId) : null);
        if (tid && ids.some((id) => String(id) === tid)) {
          return {
            ...t,
            emailId: typeof t.emailId === 'object'
              ? { ...t.emailId, isTrash: false }
              : { _id: t.emailId, isTrash: false, subject: t.emailSubject }
          };
        }
        return t;
      })
    );

    setCounts((prev) => ({
      ...prev,
      bin: Math.max(0, prev.bin - ids.length),
      all: prev.all + ids.length
    }));

    try {
      await Promise.all(ids.map((id) => emailApi.updateEmail(id, { isTrash: false })));
      setSelectedEmailIds(new Set());
      loadEmails();
      loadCounts();
      showToast({ message: `${ids.length} conversation(s) restored.`, duration: 4000 });
    } catch (err) {
      console.error('Error restoring emails:', err);
    }
  };

  // Mark Read / Unread
  const handleMarkReadSelected = async (targetIds = null) => {
    const ids = targetIds || Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    // Instant optimistic update
    const unreadCount = rawEmails.filter((e) => ids.includes(e._id) && !e.isRead).length;
    if (unreadCount > 0) {
      setCounts((prev) => ({ ...prev, inbox: Math.max(0, prev.inbox - unreadCount) }));
    }
    setRawEmails((prev) =>
      prev.map((e) => (ids.includes(e._id) ? { ...e, isRead: true } : e))
    );
    setSelectedEmailIds(new Set());

    try {
      await Promise.all(ids.map((id) => emailApi.updateEmail(id, { isRead: true })));
      loadEmails();
      loadCounts();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkUnreadSelected = async (targetIds = null) => {
    const ids = targetIds || Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    // Instant optimistic update
    const readCount = rawEmails.filter((e) => ids.includes(e._id) && e.isRead).length;
    if (readCount > 0) {
      setCounts((prev) => ({ ...prev, inbox: prev.inbox + readCount }));
    }
    setRawEmails((prev) =>
      prev.map((e) => (ids.includes(e._id) ? { ...e, isRead: false } : e))
    );
    setSelectedEmailIds(new Set());

    try {
      await Promise.all(ids.map((id) => emailApi.updateEmail(id, { isRead: false })));
      loadEmails();
      loadCounts();
    } catch (err) {
      console.error('Error marking as unread:', err);
    }
  };

  // Report Spam / Not Spam with instant counts
  const handleReportSpam = async (emailId) => {
    setCounts((prev) => ({
      ...prev,
      inbox: activeFolder === 'inbox' ? Math.max(0, prev.inbox - 1) : prev.inbox,
      spam: prev.spam + 1,
      all: Math.max(0, prev.all - 1)
    }));

    try {
      await emailApi.reportSpam(emailId);
      loadEmails();
      loadCounts();
      showToast({ message: 'Conversation reported as spam.', duration: 4000 });
    } catch (err) {
      console.error('Report spam error:', err);
      alert('Could not report as spam.');
    }
  };

  const handleNotSpam = async (emailId) => {
    setCounts((prev) => ({
      ...prev,
      spam: Math.max(0, prev.spam - 1),
      inbox: prev.inbox + 1,
      all: prev.all + 1
    }));

    try {
      await emailApi.markNotSpam(emailId);
      loadEmails();
      loadCounts();
      showToast({ message: 'Conversation moved to Inbox.', duration: 4000 });
    } catch (err) {
      console.error('Not spam error:', err);
      alert('Could not move to Inbox.');
    }
  };

  // Empty Folder (Bin or Spam)
  const handleEmptyFolder = async () => {
    const folder = confirmEmptyDialog.folder;
    setCounts((prev) => ({
      ...prev,
      bin: folder === 'bin' ? 0 : prev.bin,
      spam: folder === 'spam' ? 0 : prev.spam
    }));

    try {
      await emailApi.emptyFolder(folder);
      setConfirmEmptyDialog({ isOpen: false, folder: '' });
      loadEmails();
      loadCounts();
      showToast({
        message: folder === 'bin' ? 'Bin emptied.' : 'All spam messages deleted.',
        duration: 4000
      });
    } catch (err) {
      console.error('Empty folder error:', err);
      alert('Failed to empty folder.');
    }
  };

  // Labels Management
  const handleCreateLabel = async () => {
    const name = window.prompt('Enter a name for the new label:');
    if (!name?.trim()) return;

    try {
      await labelApi.createLabel(name.trim());
      setLabelFeedback({ text: 'Label created.', isError: false });
      loadLabels();
    } catch (err) {
      setLabelFeedback({ text: err.message || 'Error creating label.', isError: true });
    }
  };

  const handleRenameLabel = async (label) => {
    const name = window.prompt('Rename this label:', label.name);
    if (!name?.trim() || name.trim() === label.name) return;

    try {
      await labelApi.renameLabel(label._id, name.trim());
      setLabelFeedback({ text: 'Label renamed.', isError: false });
      loadLabels();
      loadEmails();
    } catch (err) {
      setLabelFeedback({ text: err.message || 'Error renaming label.', isError: true });
    }
  };

  const handleDeleteLabel = async (label) => {
    if (!window.confirm(`Delete the "${label.name}" label? Emails will not be deleted.`)) return;

    try {
      await labelApi.deleteLabel(label._id);
      if (activeLabelId === label._id) {
        setActiveLabelId(null);
        setActiveFolder('inbox');
      }
      setLabelFeedback({ text: 'Label deleted.', isError: false });
      loadLabels();
      loadEmails();
    } catch (err) {
      setLabelFeedback({ text: err.message || 'Error deleting label.', isError: true });
    }
  };

  const handleApplyLabel = async (labelId, emailIds = null) => {
    const ids = emailIds || Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    // Optimistically update rawEmails, currentOpenEmail, and threadEmails
    setRawEmails((prev) =>
      prev.map((e) => {
        if (ids.includes(e._id)) {
          const labels = new Set((e.labels || []).map(String));
          labels.add(String(labelId));
          return { ...e, labels: Array.from(labels) };
        }
        return e;
      })
    );

    if (currentOpenEmail) {
      const labels = new Set((currentOpenEmail.labels || []).map(String));
      labels.add(String(labelId));
      setCurrentOpenEmail((prev) => ({ ...prev, labels: Array.from(labels) }));
    }

    setThreadEmails((prev) =>
      prev.map((m) => {
        if (ids.includes(m._id) || (currentOpenEmail && m._id === currentOpenEmail._id)) {
          const labels = new Set((m.labels || []).map(String));
          labels.add(String(labelId));
          return { ...m, labels: Array.from(labels) };
        }
        return m;
      })
    );

    try {
      await emailApi.bulkUpdateLabels(ids, labelId, 'apply');
      setSelectedEmailIds(new Set());
      loadEmails();
      showToast({ message: 'Label applied.', duration: 4000 });
    } catch (err) {
      console.error('Error applying label:', err);
    }
  };

  const handleRemoveLabel = async (labelId, emailIds = null) => {
    const ids = emailIds || Array.from(selectedEmailIds);
    if (ids.length === 0) return;

    // Optimistically update rawEmails, currentOpenEmail, and threadEmails
    setRawEmails((prev) =>
      prev.map((e) => {
        if (ids.includes(e._id)) {
          const labels = (e.labels || []).filter((id) => String(id) !== String(labelId));
          return { ...e, labels };
        }
        return e;
      })
    );

    if (currentOpenEmail) {
      const labels = (currentOpenEmail.labels || []).filter((id) => String(id) !== String(labelId));
      setCurrentOpenEmail((prev) => ({ ...prev, labels }));
    }

    setThreadEmails((prev) =>
      prev.map((m) => {
        if (ids.includes(m._id) || (currentOpenEmail && m._id === currentOpenEmail._id)) {
          const labels = (m.labels || []).filter((id) => String(id) !== String(labelId));
          return { ...m, labels };
        }
        return m;
      })
    );

    try {
      await emailApi.bulkUpdateLabels(ids, labelId, 'remove');
      setSelectedEmailIds(new Set());
      loadEmails();
      showToast({ message: 'Label removed.', duration: 4000 });
    } catch (err) {
      console.error('Error removing label:', err);
    }
  };

  // AI Action Extraction
  const handleExtractActions = async (emailId, forceRefresh = false) => {
    setIsExtractingActions(true);
    try {
      const res = await taskApi.extractActions(emailId, forceRefresh);
      setEmailTasks(res.tasks || []);
      loadCounts();
      showToast({
        message: `${res.tasks?.length || 0} action items extracted.`,
        duration: 4000
      });
    } catch (err) {
      console.error('Error extracting actions:', err);
      alert('Could not extract actions from this message.');
    } finally {
      setIsExtractingActions(false);
    }
  };

  // Task Toggle Status & Delete
  const handleToggleTaskStatus = async (taskId, newStatus) => {
    // Instant optimistic count update
    if (newStatus === 'Completed') {
      setCounts((prev) => ({ ...prev, actions: Math.max(0, prev.actions - 1) }));
    } else {
      setCounts((prev) => ({ ...prev, actions: prev.actions + 1 }));
    }

    setEmailTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await taskApi.updateTask(taskId, { status: newStatus });
      loadCounts();
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setCounts((prev) => ({ ...prev, actions: Math.max(0, prev.actions - 1) }));
    setEmailTasks((prev) => prev.filter((t) => t._id !== taskId));
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    try {
      await taskApi.deleteTask(taskId);
      loadCounts();
      showToast({ message: 'Task deleted.', duration: 4000 });
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Compose / Reply / Reply All / Forward triggers
  const handleOpenCompose = () => {
    setComposeInitialData(null);
    setIsComposeOpen(true);
  };

  const handleReply = (email) => {
    const replyRecipient = email.sender?.toLowerCase() === user.email.toLowerCase()
      ? (email.receiver ? email.receiver.split(',')[0].trim() : '')
      : (email.sender || '');

    const origSubj = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubj = origSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();

    setComposeInitialData({
      recipients: replyRecipient ? [replyRecipient] : [],
      subject: cleanSubj ? `Re: ${cleanSubj}` : 'Re: ',
      body: `\n\n\nOn ${new Date(email.timestamp).toLocaleString()} ${email.sender} wrote:\n${email.body || ''}`,
      threadId: email.threadId || email._id,
      inReplyTo: email._id,
      title: 'Reply'
    });
    setIsComposeOpen(true);
  };

  const handleReplyAll = (email) => {
    const participantsSet = new Set();
    if (email.sender && email.sender.toLowerCase() !== user.email.toLowerCase()) {
      participantsSet.add(email.sender.toLowerCase());
    }
    if (email.receiver) {
      email.receiver.split(',').forEach((r) => {
        const clean = r.trim().toLowerCase();
        if (clean && clean !== user.email.toLowerCase()) participantsSet.add(clean);
      });
    }

    const origSubj = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubj = origSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();

    setComposeInitialData({
      recipients: Array.from(participantsSet),
      subject: cleanSubj ? `Re: ${cleanSubj}` : 'Re: ',
      body: `\n\n\nOn ${new Date(email.timestamp).toLocaleString()} ${email.sender} wrote:\n${email.body || ''}`,
      threadId: email.threadId || email._id,
      inReplyTo: email._id,
      title: 'Reply all'
    });
    setIsComposeOpen(true);
  };

  const handleForward = (email) => {
    const origSubj = email.subject === '(No Subject)' ? '' : (email.subject || '');
    const cleanSubj = origSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim();

    setComposeInitialData({
      recipients: [],
      subject: cleanSubj ? `Fwd: ${cleanSubj}` : 'Fwd: ',
      body: `\n\n\n---------- Forwarded message ---------\nFrom: ${email.sender}\nDate: ${new Date(email.timestamp).toLocaleString()}\nSubject: ${origSubj || '(No Subject)'}\nTo: ${email.receiver || ''}\n\n${email.body || ''}`,
      title: 'Forward'
    });
    setIsComposeOpen(true);
  };

  // Undo Send handler with instant count updates
  const handleSendSuccess = ({ sentEmail, undoContext }) => {
    setIsComposeOpen(false);
    setCounts((prev) => ({
      ...prev,
      sent: prev.sent + 1,
      all: prev.all + 1,
      drafts: undoContext?.draftId ? Math.max(0, prev.drafts - 1) : prev.drafts
    }));
    loadEmails();
    loadCounts();

    if (sentEmail?._id) {
      showToast({
        message: 'Message sent',
        actionText: 'Undo',
        duration: 8000,
        onAction: async () => {
          try {
            const undoRes = await emailApi.undoSend(sentEmail._id);
            const draftEmail = undoRes.email;

            // Re-open compose modal with restored draft
            setComposeInitialData({
              draftId: draftEmail._id,
              recipients: undoContext.recipients || [],
              subject: undoContext.subject === '(No Subject)' ? '' : undoContext.subject,
              body: undoContext.body || '',
              attachments: draftEmail.attachments || [],
              threadId: undoContext.threadId,
              inReplyTo: undoContext.inReplyTo,
              title: 'Edit Message'
            });
            setIsComposeOpen(true);
            loadEmails();
            loadCounts();
            showToast({ message: 'Sending undone.', duration: 4000 });
          } catch (err) {
            console.error('Error undoing send:', err);
            showToast({ message: 'Could not undo send.', duration: 4000 });
          }
        }
      });
    }
  };

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Top Header */}
      <Header
        user={user}
        onToggleSidebar={handleToggleSidebar}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenHelp={() => setIsHelpOpen(true)}
        onLogout={() => {
          logout();
          navigate('/signin');
        }}
      />

      <div className="app-body">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={isMobileSidebarOpen}
          activeFolder={activeFolder}
          activeLabelId={activeLabelId}
          onSelectFolder={handleSelectFolder}
          onSelectLabel={handleSelectLabel}
          onOpenCompose={handleOpenCompose}
          counts={counts}
          customLabels={customLabels}
          labelFeedback={labelFeedback}
          onCreateLabel={handleCreateLabel}
          onRenameLabel={handleRenameLabel}
          onDeleteLabel={handleDeleteLabel}
        />

        {/* Main Mail Panel */}
        <main className="mail-panel">
          {/* Action Bar (hidden on Actions panel view) */}
          {activeFolder !== 'actions' && (
            <MailActionBar
              activeFolder={activeFolder}
              selectedCount={selectedEmailIds.size}
              totalCount={groupedEmails.length}
              allSelected={
                groupedEmails.length > 0 &&
                groupedEmails.every((e) =>
                  (e.threadEmailIds?.length > 0 ? e.threadEmailIds : [e._id]).every((id) =>
                    selectedEmailIds.has(String(id))
                  )
                )
              }
              onToggleSelectAll={handleToggleSelectAll}
              onDeleteSelected={handleDeleteSelected}
              onRestoreSelected={handleRestoreSelected}
              onMarkReadSelected={() => handleMarkReadSelected()}
              onMarkUnreadSelected={() => handleMarkUnreadSelected()}
              onReportSpamSelected={() => {
                Array.from(selectedEmailIds).forEach(handleReportSpam);
              }}
              onNotSpamSelected={() => {
                Array.from(selectedEmailIds).forEach(handleNotSpam);
              }}
              onRefresh={() => {
                loadEmails();
                loadCounts();
              }}
              customLabels={customLabels}
              onApplyLabel={handleApplyLabel}
              onRemoveLabel={handleRemoveLabel}
            />
          )}

          {/* 30-Day Retention Folder Banner */}
          <FolderBanner
            activeFolder={activeFolder}
            emailCount={groupedEmails.length}
            hasSearchQuery={Boolean(debouncedSearch)}
            onEmptyFolder={() =>
              setConfirmEmptyDialog({ isOpen: true, folder: activeFolder })
            }
          />

          {/* Mail List Area / Actions Panel Area */}
          <div className="mail-list-container">
            {activeFolder === 'actions' ? (
              <ActionsPanel
                tasks={tasks}
                isLoading={isTasksLoading}
                userEmail={user?.email}
                trashedEmailIds={trashedEmailIds}
                onToggleTaskStatus={handleToggleTaskStatus}
                onDeleteTask={handleDeleteTask}
                onOpenSourceEmail={async (targetEmail) => {
                  try {
                    const emailId = typeof targetEmail === 'object' && targetEmail?._id
                      ? targetEmail._id
                      : targetEmail;
                    let foundEmail = rawEmails.find((e) => e._id === emailId);
                    if (!foundEmail) {
                      foundEmail = await emailApi.getEmailById(emailId);
                    }
                    if (foundEmail) {
                      handleOpenEmail(foundEmail);
                    } else {
                      alert('The original email was permanently deleted, but your task details remain safely saved here.');
                    }
                  } catch (err) {
                    alert('The original email was permanently deleted, but your task details remain safely saved here.');
                  }
                }}
              />
            ) : groupedEmails.length === 0 ? (
              <EmptyState
                activeFolder={activeFolder}
                isSearch={Boolean(debouncedSearch)}
              />
            ) : (
              <EmailList
                emails={groupedEmails}
                activeFolder={activeFolder}
                selectedIds={selectedEmailIds}
                onToggleSelect={handleToggleSelect}
                onToggleStar={handleToggleStar}
                onOpenEmail={handleOpenEmail}
                onDeleteEmail={(ids, perm) => {
                  if (activeFolder === 'bin' || perm) {
                    setConfirmDeleteDialog({
                      isOpen: true,
                      ids: Array.isArray(ids) ? ids : [ids],
                      closeDetails: false
                    });
                  } else {
                    moveEmailsToBin(ids);
                  }
                }}
                onRestoreEmail={(id) => {
                  setTrashedEmailIds((prev) => {
                    const next = new Set(prev);
                    next.delete(String(id));
                    return next;
                  });
                  setTasks((prev) =>
                    prev.map((t) => {
                      const tid = typeof t.emailId === 'object' && t.emailId?._id
                        ? String(t.emailId._id)
                        : (t.emailId ? String(t.emailId) : null);
                      if (tid && String(id) === tid) {
                        return {
                          ...t,
                          emailId: typeof t.emailId === 'object'
                            ? { ...t.emailId, isTrash: false }
                            : { _id: t.emailId, isTrash: false, subject: t.emailSubject }
                        };
                      }
                      return t;
                    })
                  );
                  emailApi.updateEmail(id, { isTrash: false }).then(() => {
                    loadEmails();
                    loadCounts();
                  });
                }}
                onReportSpam={handleReportSpam}
                onNotSpam={handleNotSpam}
                onMarkRead={(ids) => handleMarkReadSelected(ids)}
                onMarkUnread={(ids) => handleMarkUnreadSelected(ids)}
                customLabels={customLabels}
                userEmail={user?.email}
              />
            )}
          </div>

          {/* Email Details View Overlay */}
          <EmailDetailsModal
            isOpen={Boolean(currentOpenEmail)}
            email={currentOpenEmail}
            threadEmails={threadEmails}
            activeFolder={activeFolder}
            userEmail={user?.email}
            customLabels={customLabels}
            emailTasks={emailTasks}
            isExtracting={isExtractingActions}
            onClose={() => setCurrentOpenEmail(null)}
            onExtractActions={handleExtractActions}
            onToggleStar={handleToggleStar}
            onDeleteEmail={(ids, perm) => {
              if (activeFolder === 'bin' || perm || currentOpenEmail?.isTrash) {
                setConfirmDeleteDialog({
                  isOpen: true,
                  ids: Array.isArray(ids) ? ids : [ids],
                  closeDetails: true
                });
              } else {
                setCurrentOpenEmail(null);
                moveEmailsToBin(ids);
              }
            }}
            onRestoreEmail={(id) => {
              setTrashedEmailIds((prev) => {
                const next = new Set(prev);
                next.delete(String(id));
                return next;
              });
              setTasks((prev) =>
                prev.map((t) => {
                  const tid = typeof t.emailId === 'object' && t.emailId?._id
                    ? String(t.emailId._id)
                    : (t.emailId ? String(t.emailId) : null);
                  if (tid && String(id) === tid) {
                    return {
                      ...t,
                      emailId: typeof t.emailId === 'object'
                        ? { ...t.emailId, isTrash: false }
                        : { _id: t.emailId, isTrash: false, subject: t.emailSubject }
                    };
                  }
                  return t;
                })
              );
              emailApi.updateEmail(id, { isTrash: false }).then(() => {
                setCurrentOpenEmail(null);
                loadEmails();
                loadCounts();
              });
            }}
            onReportSpam={handleReportSpam}
            onNotSpam={handleNotSpam}
            onMarkUnread={(ids) => handleMarkUnreadSelected(ids)}
            onApplyLabel={handleApplyLabel}
            onRemoveLabel={handleRemoveLabel}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onToggleTaskStatus={handleToggleTaskStatus}
            onDeleteTask={handleDeleteTask}
          />
        </main>
      </div>

      {/* Compose Message Floating Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        initialData={composeInitialData}
        userEmail={user?.email}
        onClose={() => setIsComposeOpen(false)}
        onDiscard={() => setIsComposeOpen(false)}
        onSendSuccess={handleSendSuccess}
      />

      {/* Confirm Empty Folder Modal */}
      <ConfirmDialog
        isOpen={confirmEmptyDialog.isOpen}
        title={confirmEmptyDialog.folder === 'bin' ? 'Empty Bin now?' : 'Delete all spam messages now?'}
        body="All messages will be permanently deleted. This cannot be undone."
        confirmText="Delete forever"
        isDanger={true}
        onConfirm={handleEmptyFolder}
        onCancel={() => setConfirmEmptyDialog({ isOpen: false, folder: '' })}
      />

      {/* Delete Confirmation Popup - Only inside Trash Bin */}
      <ConfirmDialog
        isOpen={confirmDeleteDialog.isOpen}
        title="Delete permanently?"
        body="Do you want to permanently delete or not?"
        confirmText="Permanently Delete"
        cancelText="No"
        isDanger={true}
        onConfirm={() => {
          if (confirmDeleteDialog.closeDetails) setCurrentOpenEmail(null);
          deleteEmailsPermanently(confirmDeleteDialog.ids);
          setSelectedEmailIds(new Set());
          setConfirmDeleteDialog({
            isOpen: false,
            ids: [],
            closeDetails: false
          });
        }}
        onCancel={() =>
          setConfirmDeleteDialog({
            isOpen: false,
            ids: [],
            closeDetails: false
          })
        }
      />

      {/* Toast Notification with Undo */}
      <ToastSnackbar toast={toast} onClose={hideToast} />

      {/* Inbox Help Guide & Tour */}
      <InboxGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
