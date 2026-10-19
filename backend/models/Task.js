const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true,
    index: true
  },
  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    required: [true, 'Associated email ID is required'],
    index: true
  },
  emailSubject: {
    type: String,
    default: '',
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  deadline: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: {
      values: ['High', 'Medium', 'Low'],
      message: '{VALUE} is not a valid priority (High, Medium, Low)'
    },
    default: 'Medium'
  },
  reason: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['Pending', 'Completed'],
      message: '{VALUE} is not a valid status (Pending, Completed)'
    },
    default: 'Pending',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Composite index to support efficient user queries by status and email reference
taskSchema.index({ userEmail: 1, emailId: 1 });
taskSchema.index({ userEmail: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
