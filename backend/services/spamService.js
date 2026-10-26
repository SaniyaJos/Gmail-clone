/**
 * Spam Service
 * Respects user sender preferences (blocked / allowed).
 */

const SpamPreference = require('../models/SpamPreference');
const { classifyWithML } = require('./mlClassifier');

/**
 * Decides whether a newly received email goes to Spam.
 * 1. Checks user preference (if sender previously reported or allowed).
 * 2. Runs the ML spam classification model.
 * Returns { isSpam, score, reasons }.
 */
async function classifyIncoming({ owner, sender, subject, body }) {
  try {
    const preference = await SpamPreference.findOne({
      owner: (owner || '').toLowerCase(),
      sender: (sender || '').toLowerCase()
    }).lean();

    if (preference && preference.action === 'blocked') {
      return {
        isSpam: true,
        score: 5,
        reasons: ['You previously reported messages from this sender as spam.']
      };
    }
    if (preference && preference.action === 'allowed') {
      return {
        isSpam: false,
        score: 0,
        reasons: []
      };
    }
  } catch (err) {
    console.error('Spam preference lookup failed:', err.message);
  }

  // Pure Machine Learning Spam Detection
  const fullText = `${subject || ''}\n${body || ''}`.trim();
  const mlResult = await classifyWithML(fullText);

  if (mlResult && mlResult.isSpam && mlResult.confidence >= 0.5) {
    return {
      isSpam: true,
      score: 5,
      reasons: ['It is similar to messages that were identified as spam.']
    };
  }

  return {
    isSpam: false,
    score: 0,
    reasons: []
  };
}

/**
 * Remembers the user's decision about a sender ('blocked' or 'allowed').
 */
async function rememberSenderDecision(owner, sender, action) {
  if (!owner || !sender || owner.toLowerCase() === sender.toLowerCase()) return;
  await SpamPreference.findOneAndUpdate(
    { owner: owner.toLowerCase(), sender: sender.toLowerCase() },
    { action, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}

module.exports = {
  classifyIncoming,
  rememberSenderDecision
};