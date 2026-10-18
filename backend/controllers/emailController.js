/**
 * Email Controller - Handles all email CRUD operations, folder queries, search, and status toggles.
 */

const mongoose = require('mongoose');
const Email = require('../models/Email');
const User = require('../models/User');
const { classifyIncoming, rememberSenderDecision } = require('../services/spamService');
const { RETENTION_DAYS } = require('../services/cleanupService');

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

/**
 * Enriches a list of email objects with the sender's display first name.
 */
async function addSenderNames(emails) {
  const senderEmails = [...new Set(emails.map(email => email.sender))];
  const senders = await User.find({ email: { $in: senderEmails } }, 'email firstName').lean();
  const senderNames = new Map(senders.map(user => [user.email, user.firstName]));

  return emails.map(email => ({
    ...email,
    firstName: senderNames.get(email.sender) || null
  }));
}

/**
 * For Bin and Spam, tells the frontend how many days are left before the
 * automatic 30-day deletion (daysLeft) so it can show it in the list.
 */
function addExpiryInfo(emails, folder) {
  if (folder !== 'bin' && folder !== 'spam') return emails;

  const DAY_MS = 24 * 60 * 60 * 1000;
  return emails.map(email => {
    const since = folder === 'bin' ? email.trashedAt : email.spamAt;
    const startedAt = since ? new Date(since).getTime() : Date.now();
    const daysLeft = Math.max(0, Math.ceil((startedAt + RETENTION_DAYS * DAY_MS - Date.now()) / DAY_MS));
    return { ...email, daysLeft };
  });
}

// ==========================================
// 2. EMAIL CREATION & SENDING
// ==========================================

/**
 * POST /api/emails
 * Sends an email or saves a draft.
 * - For drafts or self-sent emails: saves a single copy owned by sender.
 * - For normal emails: saves separate copies for sender (sent) and receiver (inbox).
 */
async function createEmail(req, res) {
  try {
    const { sender, receiver, subject, body, isDraft } = req.body;

    // Drafts may be saved without a receiver; real emails need one
    if (!sender || (!receiver && !isDraft)) {
      return res.status(400).json({ message: 'Sender and Receiver are required' });
    }

    const emailData = {
      sender,
      receiver: receiver || '',
      subject: subject || '(No Subject)',
      body: body || '',
      isDraft: Boolean(isDraft)
    };

    let savedEmail;

    if (isDraft || sender.toLowerCase() === receiver.toLowerCase()) {
      // Single copy for drafts or self-sent emails
      savedEmail = await new Email({
        ...emailData,
        owner: sender.toLowerCase(),
        isRead: false
      }).save();
    } else {
      // Two copies: one for sender's Sent box, one for recipient's Inbox
      savedEmail = await new Email({
        ...emailData,
        owner: sender.toLowerCase(),
        isRead: true
      }).save();

      // Run spam detection on the recipient's copy only
      const verdict = await classifyIncoming({
        owner: receiver,
        sender,
        subject: emailData.subject,
        body: emailData.body
      });

      await new Email({
        ...emailData,
        owner: receiver.toLowerCase(),
        isRead: false,
        isSpam: verdict.isSpam,
        spamAt: verdict.isSpam ? new Date() : null,
        spamScore: verdict.score,
        spamReasons: verdict.isSpam ? verdict.reasons : []
      }).save();
    }

    return res.status(201).json({
      message: isDraft ? 'Draft saved successfully' : 'Email sent successfully',
      email: savedEmail
    });
  } catch (err) {
    console.error('Save email error:', err);
    return res.status(500).json({ message: 'Internal server error while saving email' });
  }
}

// ==========================================
// 3. SEARCH & RETRIEVAL
// ==========================================

/**
 * Builds a MongoDB filter query for email search terms (e.g. from:, to:, subject:, -term).
 */
function buildEmailSearchFilter(queryEmail, folder, searchQuery) {
  const conditions = [{ isTrash: folder === 'bin' }];

  // Spam is only visible in the Spam folder; every other search hides it.
  // ($ne: true also matches old emails that don't have the isSpam field yet)
  conditions.push(folder === 'spam' ? { isSpam: true } : { isSpam: { $ne: true } });

  // Keep drafts out of normal search results; the Drafts folder searches only drafts
  if (folder !== 'bin') {
    conditions.push({ isDraft: folder === 'drafts' });
  }
  const tokens = searchQuery.match(/(?:\w+:)?-?(?:"[^"]+"|\S+)/g) || [];
  const searchableFields = ['sender', 'receiver', 'subject', 'body'];

  tokens.forEach(token => {
    const separator = token.indexOf(':');
    const qualifier = separator > 0 ? token.slice(0, separator).toLowerCase() : '';
    const rawValue = separator > 0 ? token.slice(separator + 1) : token;
    const excluded = !qualifier && rawValue.startsWith('-');
    const value = (excluded ? rawValue.slice(1) : rawValue).replace(/^"|"$/g, '');
    if (!value) return;

    const expression = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    if (excluded) {
      conditions.push({ $nor: searchableFields.map(field => ({ [field]: expression })) });
    } else if (qualifier === 'from') {
      conditions.push({ sender: expression });
    } else if (qualifier === 'to') {
      conditions.push({ receiver: expression });
    } else if (qualifier === 'subject') {
      conditions.push({ subject: expression });
    } else if (qualifier === 'is' && value.toLowerCase() === 'starred') {
      conditions.push({ isStarred: true });
    } else if (qualifier === 'is' && value.toLowerCase() === 'unread') {
      conditions.push({ isRead: false });
    } else if (qualifier === 'is' && value.toLowerCase() === 'read') {
      conditions.push({ isRead: true });
    } else {
      conditions.push({ $or: searchableFields.map(field => ({ [field]: expression })) });
    }
  });

  return { owner: queryEmail, $and: conditions };
}

async function getEmails(req, res) {
  try {
    const { email, folder, q } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'User email query parameter is required' });
    }

    const queryEmail = email.toLowerCase();
    const filter = { owner: queryEmail };

    if (typeof q === 'string' && q.trim()) {
      const emails = await Email.find(buildEmailSearchFilter(queryEmail, folder, q.trim()))
        .sort({ timestamp: -1 })
        .lean();
      return res.status(200).json(addExpiryInfo(await addSenderNames(emails), folder));
    }

    switch (folder) {
      case 'inbox':
        filter.receiver = queryEmail;
        filter.isTrash = false;
        filter.isDraft = false;
        filter.isSpam = { $ne: true };
        break;
      case 'sent':
        filter.sender = queryEmail;
        filter.isTrash = false;
        filter.isDraft = false;
        filter.isSpam = { $ne: true };
        break;
      case 'starred':
        filter.isStarred = true;
        filter.isTrash = false;
        filter.isSpam = { $ne: true };
        break;
      case 'drafts':
        filter.sender = queryEmail;
        filter.isTrash = false;
        filter.isDraft = true;
        break;
      case 'spam':
        filter.isSpam = true;
        filter.isTrash = false;
        filter.isDraft = false;
        break;
      case 'bin':
        filter.isTrash = true;
        break;
      case 'all':
      default:
        filter.isTrash = false;
        filter.isDraft = false;
        filter.isSpam = { $ne: true };
        break;
    }

    const emails = await Email.find(filter).sort({ timestamp: -1 }).lean();
    return res.status(200).json(addExpiryInfo(await addSenderNames(emails), folder));
  } catch (err) {
    console.error('Fetch emails error:', err);
    return res.status(500).json({ message: 'Internal server error while fetching emails' });
  }
}

async function getStarredEmails(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'User email query parameter is required' });
    }

    const emails = await Email.find({
      owner: email.toLowerCase(),
      isStarred: true,
      isTrash: false,
      isSpam: { $ne: true }
    }).sort({ timestamp: -1 }).lean();

    return res.status(200).json(await addSenderNames(emails));
  } catch (err) {
    console.error('Fetch starred emails error:', err);
    return res.status(500).json({ message: 'Internal server error while fetching starred emails' });
  }
}

// ==========================================
// 4. STARRED STATUS MANAGEMENT
// ==========================================

/**
 * Updates the isStarred flag for an email by its ID.
 */
async function updateStarredStatus(req, res, isStarred) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid email ID' });
  }

  try {
    const email = await Email.findByIdAndUpdate(
      id,
      { isStarred },
      { new: true, runValidators: true }
    );

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    return res.status(200).json({
      message: isStarred ? 'Email starred successfully' : 'Email unstarred successfully',
      email
    });
  } catch (err) {
    console.error('Update starred status error:', err);
    return res.status(500).json({ message: 'Internal server error while updating starred status' });
  }
}

function starEmail(req, res) {
  return updateStarredStatus(req, res, true);
}

function unstarEmail(req, res) {
  return updateStarredStatus(req, res, false);
}

async function toggleStarredEmail(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid email ID' });
  }

  try {
    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    email.isStarred = !email.isStarred;
    await email.save();

    return res.status(200).json({
      message: email.isStarred ? 'Email starred successfully' : 'Email unstarred successfully',
      email
    });
  } catch (err) {
    console.error('Toggle starred status error:', err);
    return res.status(500).json({ message: 'Internal server error while toggling starred status' });
  }
}

// ==========================================
// 5. GENERAL STATUS UPDATES (READ, TRASH, ETC.)
// ==========================================

/**
 * PATCH /api/emails/:id
 * Updates boolean status flags (isStarred, isRead, isTrash, isDraft).
 */
async function updateEmail(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid email ID' });
  }

  try {
    const updateFields = {};
    const allowedUpdates = ['isStarred', 'isRead', 'isTrash', 'isDraft'];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    // Start / reset the 30-day Bin timer whenever an email is trashed or restored
    if (updateFields.isTrash === true) {
      updateFields.trashedAt = new Date();
    } else if (updateFields.isTrash === false) {
      updateFields.trashedAt = null;
    }

    const email = await Email.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true
    });

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    return res.status(200).json({ message: 'Email updated successfully', email });
  } catch (err) {
    console.error('Update email status error:', err);
    return res.status(500).json({ message: 'Internal server error while updating email status' });
  }
}

// ==========================================
// 6. DRAFT UPDATES
// ==========================================

/**
 * PATCH /api/emails/:id/draft
 * Updates an existing draft's recipient, subject, body, and timestamp.
 */
async function updateDraft(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid email ID' });
  }

  try {
    const { receiver, subject, body } = req.body;

    // Only documents that are still drafts can be edited this way
    const draft = await Email.findOneAndUpdate(
      { _id: id, isDraft: true },
      {
        receiver: receiver || '',
        subject: subject || '(No Subject)',
        body: body || '',
        timestamp: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    return res.status(200).json({ message: 'Draft updated successfully', email: draft });
  } catch (err) {
    console.error('Update draft error:', err);
    return res.status(500).json({ message: 'Internal server error while updating draft' });
  }
}

// ==========================================
// 7. PERMANENT DELETION
// ==========================================

/**
 * DELETE /api/emails/:id
 * Permanently deletes an email document from the database (hard delete).
 */
async function deleteEmail(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid email ID' });
  }

  try {
    const email = await Email.findByIdAndDelete(id);

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    return res.status(200).json({ message: 'Email permanently deleted' });
  } catch (err) {
    console.error('Delete email error:', err);
    return res.status(500).json({ message: 'Internal server error while deleting email' });
  }
}

// ==========================================
// 8. SPAM ACTIONS (REPORT SPAM / NOT SPAM)
// ==========================================

/**
 * Loads an email and makes sure it belongs to the requesting user.
 * Sends the error response itself and returns null when the check fails.
 */
async function findOwnedEmail(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'Invalid email ID' });
    return null;
  }

  const email = await Email.findById(id);
  if (!email) {
    res.status(404).json({ message: 'Email not found' });
    return null;
  }

  if (email.owner !== req.user.email) {
    res.status(403).json({ message: 'You can only change your own emails' });
    return null;
  }

  return email;
}

/**
 * PATCH /api/emails/:id/report-spam
 * Moves an email to Spam and remembers the sender, so future mail from
 * the same sender is delivered straight to Spam.
 */
async function reportSpam(req, res) {
  try {
    const email = await findOwnedEmail(req, res);
    if (!email) return;

    if (email.isDraft || email.sender === req.user.email) {
      return res.status(400).json({ message: 'Only received emails can be reported as spam' });
    }

    email.isSpam = true;
    email.spamAt = new Date();
    email.isTrash = false;
    email.trashedAt = null;
    email.isStarred = false;
    if (!email.spamReasons || email.spamReasons.length === 0) {
      email.spamReasons = ['You reported this message as spam'];
    }
    await email.save();

    await rememberSenderDecision(req.user.email, email.sender, 'blocked');

    return res.status(200).json({ message: 'Message reported as spam', email });
  } catch (err) {
    console.error('Report spam error:', err);
    return res.status(500).json({ message: 'Internal server error while reporting spam' });
  }
}

/**
 * PATCH /api/emails/:id/not-spam
 * Moves an email back to the Inbox and remembers that this sender is trusted.
 */
async function markNotSpam(req, res) {
  try {
    const email = await findOwnedEmail(req, res);
    if (!email) return;

    email.isSpam = false;
    email.spamAt = null;
    email.spamScore = 0;
    email.spamReasons = [];
    await email.save();

    await rememberSenderDecision(req.user.email, email.sender, 'allowed');

    return res.status(200).json({ message: 'Message moved to Inbox', email });
  } catch (err) {
    console.error('Not spam error:', err);
    return res.status(500).json({ message: 'Internal server error while marking email as not spam' });
  }
}

// ==========================================
// 9. EMPTY BIN / SPAM NOW
// ==========================================

/**
 * DELETE /api/emails/folder/:folder/empty   (folder = bin | spam)
 * Permanently deletes every email in the user's Bin or Spam folder.
 */
async function emptyFolder(req, res) {
  try {
    const { folder } = req.params;
    const owner = req.user.email;

    let filter;
    if (folder === 'bin') {
      filter = { owner, isTrash: true };
    } else if (folder === 'spam') {
      filter = { owner, isSpam: true, isTrash: false };
    } else {
      return res.status(400).json({ message: 'Only the bin and spam folders can be emptied' });
    }

    const result = await Email.deleteMany(filter);
    return res.status(200).json({
      message: `Permanently deleted ${result.deletedCount} email(s)`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Empty folder error:', err);
    return res.status(500).json({ message: 'Internal server error while emptying folder' });
  }
}

// ==========================================
// 10. SIDEBAR COUNTS
// ==========================================

/**
 * GET /api/emails/counts
 * Returns the number shown next to the Spam folder in the sidebar.
 */
async function getFolderCounts(req, res) {
  try {
    const owner = req.user.email;
    const spamUnread = await Email.countDocuments({
      owner,
      isSpam: true,
      isTrash: false,
      isDraft: false,
      isRead: false
    });
    return res.status(200).json({ spamUnread });
  } catch (err) {
    console.error('Folder counts error:', err);
    return res.status(500).json({ message: 'Internal server error while counting emails' });
  }
}

module.exports = {
  createEmail,
  getEmails,
  getStarredEmails,
  starEmail,
  unstarEmail,
  toggleStarredEmail,
  updateEmail,
  updateDraft,
  deleteEmail,
  reportSpam,
  markNotSpam,
  emptyFolder,
  getFolderCounts
};