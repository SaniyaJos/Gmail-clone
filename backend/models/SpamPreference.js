const mongoose = require('mongoose');

/**
 * Remembers what a user decided about a particular sender.
 *  - 'blocked' : the user clicked "Report spam" -> future mail from this sender goes to Spam
 *  - 'allowed' : the user clicked "Not spam"    -> future mail from this sender skips spam detection
 * One document per (owner, sender) pair.
 */
const spamPreferenceSchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  sender: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  action: {
    type: String,
    enum: ['blocked', 'allowed'],
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

spamPreferenceSchema.index({ owner: 1, sender: 1 }, { unique: true });

module.exports = mongoose.model('SpamPreference', spamPreferenceSchema);