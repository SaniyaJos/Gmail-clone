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
  }
});

module.exports = mongoose.model('Email', emailSchema);