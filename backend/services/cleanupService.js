/**
 * Cleanup Service - automatic 30-day deletion for Bin and Spam
 *
 * Every email in Bin (isTrash) or Spam (isSpam) carries a timestamp
 * (trashedAt / spamAt). Once that timestamp is older than RETENTION_DAYS,
 * the email is permanently deleted from MongoDB.
 *
 * The job runs once when the server starts and then every hour.
 */

const Email = require('../models/Email');
const { removeUnreferencedAttachments } = require('./attachmentStorage');

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns the Date before which Bin/Spam emails are considered expired.
 */
function getCutoffDate(now = new Date()) {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}

/**
 * Deletes every Bin/Spam email older than RETENTION_DAYS.
 * Returns the number of deleted emails.
 */
async function purgeExpiredEmails(now = new Date()) {
  // Emails that were trashed / flagged before this feature existed have no
  // timestamp yet. Start their 30-day clock now instead of deleting them instantly.
  await Email.updateMany({ isTrash: true, trashedAt: null }, { $set: { trashedAt: now } });
  await Email.updateMany({ isSpam: true, spamAt: null }, { $set: { spamAt: now } });

  const cutoff = getCutoffDate(now);
  const expiredEmails = await Email.find({
    $or: [
      { isTrash: true, trashedAt: { $lte: cutoff } },
      { isSpam: true, spamAt: { $lte: cutoff } }
    ]
  }).select('attachments.storageName').lean();
  const result = await Email.deleteMany({
    $or: [
      { isTrash: true, trashedAt: { $lte: cutoff } },
      { isSpam: true, spamAt: { $lte: cutoff } }
    ]
  });

  await removeUnreferencedAttachments(
    expiredEmails.flatMap(email => (email.attachments || []).map(attachment => attachment.storageName))
  );
  return result.deletedCount || 0;
}

async function runCleanupSafely() {
  try {
    const deleted = await purgeExpiredEmails();
    if (deleted > 0) {
      console.log(`[Cleanup] Permanently deleted ${deleted} email(s) older than ${RETENTION_DAYS} days from Bin/Spam`);
    }
  } catch (err) {
    console.error('[Cleanup] Failed to purge expired emails:', err.message);
  }
}

/**
 * Runs the cleanup immediately and then on a fixed interval.
 * Call once, after MongoDB is connected.
 */
function startCleanupScheduler() {
  runCleanupSafely();
  const timer = setInterval(runCleanupSafely, CLEANUP_INTERVAL_MS);
  timer.unref(); // don't keep the process alive just for this timer
  console.log(`[Cleanup] Auto-delete scheduler started (Bin & Spam older than ${RETENTION_DAYS} days, checked hourly)`);
  return timer;
}

module.exports = {
  RETENTION_DAYS,
  getCutoffDate,
  purgeExpiredEmails,
  startCleanupScheduler
};