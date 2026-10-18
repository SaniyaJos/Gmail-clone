/**
 * Spam Service
 *
 * 1. scoreEmail()      - rule-based spam scoring (keywords, links, caps, punctuation...)
 * 2. classifyIncoming() - decides whether a newly received email goes to Spam.
 *                         A user's own decision about a sender always wins over the rules:
 *                           - sender previously reported as spam  -> Spam
 *                           - sender previously marked "Not spam" -> Inbox
 *
 * No external API is needed, so it is fast and works offline.
 */

const SpamPreference = require('../models/SpamPreference');

// Emails scoring at or above this value are treated as spam
const SPAM_THRESHOLD = 5;

// [regex, points, human readable reason]
const PHRASE_RULES = [
  [/\b(you('| ha)?ve|you have) (just )?won\b|\bwinner\b|\byou are (a )?selected\b/i, 3, 'Claims you won something'],
  [/\b(lottery|jackpot|sweepstakes?)\b/i, 3, 'Mentions a lottery or jackpot'],
  [/\bclaim (your )?(prize|reward|gift|bonus)\b/i, 3, 'Asks you to claim a prize'],
  [/\b(free money|cash bonus|easy money|make money fast|earn \$?\d+ (per|a) (day|hour|week))\b/i, 3, 'Promises easy money'],
  [/\b(100% free|risk[- ]free|no obligation|no cost|free gift)\b/i, 2, 'Uses "free / risk-free" sales language'],
  [/\b(act now|limited time( offer)?|offer expires|last chance|don'?t miss out|hurry)\b/i, 2, 'Creates false urgency'],
  [/\b(click here|click below|click the link|open the attachment)\b/i, 2, 'Pushes you to click a link'],
  [/\b(verify|confirm|update|validate) your (account|password|identity|bank|card|details)\b/i, 3, 'Asks you to verify account details'],
  [/\b(password|account) (will )?(expire|expires|be suspended|has been suspended|has been locked)\b/i, 3, 'Threatens account suspension'],
  [/\b(wire transfer|western union|bank transfer|send (me )?(your )?(bank|account) (details|number))\b/i, 3, 'Asks for a money transfer'],
  [/\b(dear (friend|beneficiary|customer|winner)|beloved|inheritance|next of kin)\b/i, 2, 'Generic scam greeting'],
  [/\b(viagra|cialis|pharmacy|weight loss|miracle cure|enlargement)\b/i, 3, 'Pharmaceutical spam wording'],
  [/\b(casino|poker|betting|online gambling)\b/i, 2, 'Gambling promotion'],
  [/\b(crypto|bitcoin|btc|ethereum) (giveaway|investment|doubler|profit)\b/i, 3, 'Crypto giveaway / investment scam'],
  [/\b(loan approved|pre-?approved|credit score|debt relief|lowest rates?)\b/i, 2, 'Loan / credit offer'],
  [/\b(work from home|be your own boss|double your income|passive income)\b/i, 2, 'Get-rich-quick offer'],
  [/\b(congratulations)\b/i, 1, 'Unsolicited congratulations'],
  [/\b(urgent|immediately|asap)\b.*\b(reply|respond|action required)\b/i, 1, 'Urgent action demanded']
];

const URL_SHORTENERS = /\b(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|rb\.gy|cutt\.ly)\//i;
const IP_URL = /https?:\/\/\d{1,3}(\.\d{1,3}){3}/i;
const URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;

/**
 * Scores an email. Returns { score, reasons, isSpam }.
 */
function scoreEmail({ subject = '', body = '' }) {
  const text = `${subject}\n${body}`;
  let score = 0;
  const reasons = [];

  const add = (points, reason) => {
    score += points;
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  // 1. Phrase / keyword rules
  PHRASE_RULES.forEach(([pattern, points, reason]) => {
    if (pattern.test(text)) add(points, reason);
  });

  // 2. Links
  const urls = text.match(URL_PATTERN) || [];
  if (urls.length >= 3) add(2, 'Contains many links');
  if (URL_SHORTENERS.test(text)) add(2, 'Uses a shortened link');
  if (IP_URL.test(text)) add(3, 'Links to a raw IP address');
  if (urls.length > 0 && body.replace(URL_PATTERN, '').trim().length < 20) {
    add(2, 'Almost no text, just a link');
  }

  // 3. SHOUTING (subject or body mostly capital letters)
  const capsRatio = (str) => {
    const letters = str.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 8) return 0;
    return letters.replace(/[^A-Z]/g, '').length / letters.length;
  };
  if (capsRatio(subject) > 0.7) add(2, 'Subject is written in ALL CAPS');
  if (capsRatio(body) > 0.6) add(1, 'Body is mostly capital letters');

  // 4. Punctuation & money symbols
  if (/[!?]{3,}/.test(text)) add(1, 'Excessive punctuation');
  if ((text.match(/[$€£₹]/g) || []).length >= 3) add(1, 'Lots of currency symbols');
  if (/[$€£₹]\s?\d{1,3}(,\d{3})+/.test(text)) add(1, 'Mentions large sums of money');

  return { score, reasons, isSpam: score >= SPAM_THRESHOLD };
}

/**
 * Decides where a newly received email should go.
 * Returns { isSpam, score, reasons }.
 */
async function classifyIncoming({ owner, sender, subject, body }) {
  try {
    const preference = await SpamPreference.findOne({
      owner: owner.toLowerCase(),
      sender: sender.toLowerCase()
    }).lean();

    if (preference && preference.action === 'blocked') {
      return { isSpam: true, score: SPAM_THRESHOLD, reasons: ['You previously reported this sender as spam'] };
    }
    if (preference && preference.action === 'allowed') {
      return { isSpam: false, score: 0, reasons: [] };
    }
  } catch (err) {
    // Never lose an email because the preference lookup failed
    console.error('Spam preference lookup failed:', err.message);
  }

  return scoreEmail({ subject, body });
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
  SPAM_THRESHOLD,
  scoreEmail,
  classifyIncoming,
  rememberSenderDecision
};