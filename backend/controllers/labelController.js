const mongoose = require('mongoose');
const Email = require('../models/Email');
const Label = require('../models/Label');

function normalizeLabelName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return { name, normalizedName: name.toLocaleLowerCase('en-US') };
}

async function listLabels(req, res) {
  try {
    const labels = await Label.find({ owner: req.user.email }).sort({ normalizedName: 1 }).lean();
    return res.status(200).json(labels);
  } catch (err) {
    console.error('List labels error:', err);
    return res.status(500).json({ message: 'Unable to load labels.' });
  }
}

async function createLabel(req, res) {
  const normalized = normalizeLabelName(req.body?.name);
  if (!normalized) {
    return res.status(400).json({ message: 'Label names must contain 1 to 50 valid characters.' });
  }

  try {
    const label = await Label.create({ owner: req.user.email, ...normalized });
    return res.status(201).json({ message: 'Label created successfully.', label });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A label with that name already exists.' });
    console.error('Create label error:', err);
    return res.status(500).json({ message: 'Unable to create label.' });
  }
}

async function renameLabel(req, res) {
  const { id } = req.params;
  const normalized = normalizeLabelName(req.body?.name);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid label ID.' });
  if (!normalized) {
    return res.status(400).json({ message: 'Label names must contain 1 to 50 valid characters.' });
  }

  try {
    const label = await Label.findOneAndUpdate(
      { _id: id, owner: req.user.email },
      normalized,
      { new: true, runValidators: true }
    );
    if (!label) return res.status(404).json({ message: 'Label not found.' });
    return res.status(200).json({ message: 'Label renamed successfully.', label });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A label with that name already exists.' });
    console.error('Rename label error:', err);
    return res.status(500).json({ message: 'Unable to rename label.' });
  }
}

async function deleteLabel(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid label ID.' });

  try {
    const label = await Label.findOne({ _id: id, owner: req.user.email });
    if (!label) return res.status(404).json({ message: 'Label not found.' });
    await Email.updateMany(
      { owner: req.user.email, labels: label._id },
      { $pull: { labels: label._id } }
    );
    await Label.deleteOne({ _id: label._id, owner: req.user.email });
    return res.status(200).json({ message: 'Label deleted successfully.' });
  } catch (err) {
    console.error('Delete label error:', err);
    return res.status(500).json({ message: 'Unable to delete label.' });
  }
}

async function updateEmailLabels(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const emailIds = req.params.emailId
    ? [req.params.emailId]
    : Array.isArray(body.emailIds) ? body.emailIds : [];
  const { labelId, action } = body;

  if (!emailIds.length || emailIds.some(id => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: 'One or more email IDs are invalid.' });
  }
  if (!mongoose.isValidObjectId(labelId)) return res.status(400).json({ message: 'Invalid label ID.' });
  if (action !== 'apply' && action !== 'remove') {
    return res.status(400).json({ message: 'Action must be apply or remove.' });
  }

  try {
    const label = await Label.findOne({ _id: labelId, owner: req.user.email }).lean();
    if (!label) return res.status(404).json({ message: 'Label not found.' });

    const uniqueIds = [...new Set(emailIds.map(id => String(id).toLowerCase()))];
    const ownedEmails = await Email.find({
      _id: { $in: uniqueIds },
      owner: req.user.email
    }).select('_id').lean();
    if (ownedEmails.length !== uniqueIds.length) {
      return res.status(404).json({ message: 'One or more emails were not found.' });
    }

    const update = action === 'apply'
      ? { $addToSet: { labels: label._id } }
      : { $pull: { labels: label._id } };
    await Email.updateMany(
      { _id: { $in: uniqueIds }, owner: req.user.email },
      update
    );
    return res.status(200).json({ message: `Label ${action === 'apply' ? 'applied' : 'removed'} successfully.` });
  } catch (err) {
    console.error('Update email labels error:', err);
    return res.status(500).json({ message: 'Unable to update email labels.' });
  }
}

module.exports = {
  listLabels,
  createLabel,
  renameLabel,
  deleteLabel,
  updateEmailLabels
};
