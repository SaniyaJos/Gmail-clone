export function getAvatarColor(identifier = '') {
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

export function formatTimestamp(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDetailedTimestamp(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  return `${size >= 10 || exponent === 0 ? Math.round(size) : size.toFixed(1)} ${units[exponent]}`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function groupEmailsByThread(emails, activeFolder, userEmail) {
  if (!Array.isArray(emails)) return [];
  if (activeFolder === 'drafts') return emails;

  const threadsMap = new Map();
  const threadOrder = [];

  emails.forEach(email => {
    const rawSubj = (email.subject || '').trim();
    const cleanSubj = rawSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim().toLowerCase();
    const isNoSubject = !cleanSubj || cleanSubj === '(no subject)' || cleanSubj === 'no subject';
    
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
    rawThreadList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

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

    const latest = threadList[threadList.length - 1] || rawThreadList[0];
    const hasUnread = threadList.some(e => !e.isRead && !e.isDraft);
    const hasStarred = threadList.some(e => e.isStarred);

    let displaySenderText = '';
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
      displaySenderText = `To: ${recipNames.length > 0 ? recipNames.join(', ') : 'recipient'}`;
    } else {
      const participantNames = [];
      threadList.forEach(e => {
        const isMe = e.sender && e.sender.toLowerCase() === userEmail?.toLowerCase();
        const name = isMe
          ? 'me'
          : (e.senderName || e.firstName || (e.sender ? e.sender.split('@')[0] : 'Unknown'));
        if (!participantNames.includes(name)) {
          participantNames.push(name);
        }
      });
      displaySenderText = participantNames.join(', ');
    }

    const origSubj = latest.subject === '(No Subject)' ? '' : (latest.subject || '');
    const cleanSubject = origSubj.replace(/^(re:\s*|fwd:\s*)+/ig, '').trim() || origSubj || '(No Subject)';

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
      displaySenderText,
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

export function formatTaskDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) return null;

  const now = new Date();
  const isOverdue = deadline < now;

  const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit' };

  const hasTime = deadline.getUTCHours() !== 0 || deadline.getUTCMinutes() !== 0;
  const dateFormatted = deadline.toLocaleDateString('en-US', dateOptions);
  const timeFormatted = hasTime ? `, ${deadline.toLocaleTimeString([], timeOptions)}` : '';

  return {
    text: `${dateFormatted}${timeFormatted}`,
    isOverdue
  };
}
