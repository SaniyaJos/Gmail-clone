const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  owner: {
    type: String,
    trim: true,
    lowercase: true
  },
  sender: {
    type: String,
    required: [true, 'Sender email is required'],
    trim: true,
    lowercase: true
  },
  receiver: {
    type: String,
    // A draft is allowed to be saved before a recipient is chosen
    required: [function () { return !this.isDraft; }, 'Receiver email is required'],
    default: '',
    trim: true,
    lowercase: true
  },
  subject: {
    type: String,
    default: '(No Subject)',
    trim: true
  },
  body: {
    type: String,
    default: ''
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 0
    },
    storageName: {
      type: String,
      required: true
    }
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  isTrash: {
    type: Boolean,
    default: false
  },

  // ---- Trash (Bin) retention ----
  // Set when the email is moved to Bin, cleared on restore.
  // The cleanup job deletes emails whose trashedAt is older than 30 days.
  trashedAt: {
    type: Date,
    default: null
  },

  // ---- Spam detection ----
  isSpam: {
    type: Boolean,
    default: false
  },
  // Set when the email lands in Spam, cleared on "Not spam".
  // The cleanup job deletes emails whose spamAt is older than 30 days.
  spamAt: {
    type: Date,
    default: null
  },
  // Why the email was flagged (shown to the user in the email view)
  spamReasons: {
    type: [String],
    default: []
  },
  // Heuristic score from the spam detector (0 when not scored)
  spamScore: {
    type: Number,
    default: 0
  },

  // ---- Conversation Threading ----
  // Shared thread ID across all replies in a conversation
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    default: null
  },
  // Parent email ID that this email replied to
  inReplyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    default: null
  },
  // Batch identifier for recipient copies created during a single send (used for Undo Send)
  sendGroupId: {
    type: String,
    index: true,
    default: null
  }
});

// Indexes used by the folder queries and the 30-day cleanup job
emailSchema.index({ owner: 1, isSpam: 1, isTrash: 1 });
emailSchema.index({ isTrash: 1, trashedAt: 1 });
emailSchema.index({ isSpam: 1, spamAt: 1 });
emailSchema.index({ owner: 1, threadId: 1, timestamp: 1 });

module.exports = mongoose.model('Email', emailSchema);