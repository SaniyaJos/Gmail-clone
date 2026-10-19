const mongoose = require('mongoose');

const labelSchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  normalizedName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  }
}, { timestamps: true });

labelSchema.index({ owner: 1, normalizedName: 1 }, { unique: true });

module.exports = mongoose.model('Label', labelSchema);
