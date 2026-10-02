const mongoose = require('mongoose');
const Email = require('../models/Email');
const User = require('../models/User');

async function addSenderNames(emails) {
  const senderEmails = [...new Set(emails.map(email => email.sender))];
  const senders = await User.find({ email: { $in: senderEmails } }, 'email firstName').lean();
  const senderNames = new Map(senders.map(user => [user.email, user.firstName]));

  return emails.map(email => ({
    ...email,
    firstName: senderNames.get(email.sender) || null
  }));
}

async function createEmail(req, res) {
  try {
    const { sender, receiver, subject, body, isDraft } = req.body;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'Sender and Receiver are required' });
    }

    let savedEmail;

    if (isDraft) {
      savedEmail = new Email({
        owner: sender.toLowerCase(),
        sender,
        receiver,
        subject: subject || '(No Subject)',
        body: body || '',
        isDraft: true
      });
      await savedEmail.save();
    } else if (sender.toLowerCase() === receiver.toLowerCase()) {
      savedEmail = new Email({
        owner: sender.toLowerCase(),
        sender,
        receiver,
        subject: subject || '(No Subject)',
        body: body || '',
        isDraft: false,
        isRead: false
      });
      await savedEmail.save();
    } else {
      const senderCopy = new Email({
        owner: sender.toLowerCase(),
        sender,
        receiver,
        subject: subject || '(No Subject)',
        body: body || '',
        isDraft: false,
        isRead: true
      });
      await senderCopy.save();
      savedEmail = senderCopy;

      const receiverCopy = new Email({
        owner: receiver.toLowerCase(),
        sender,
        receiver,
        subject: subject || '(No Subject)',
        body: body || '',
        isDraft: false,
        isRead: false
      });
      await receiverCopy.save();
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

async function getEmails(req, res) {
  try {
    const { email, folder } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'User email query parameter is required' });
    }

    const queryEmail = email.toLowerCase();
    const filter = { owner: queryEmail };

    switch (folder) {
      case 'inbox':
        filter.receiver = queryEmail;
        filter.isTrash = false;
        filter.isDraft = false;
        break;
      case 'sent':
        filter.sender = queryEmail;
        filter.isTrash = false;
        filter.isDraft = false;
        break;
      case 'starred':
        filter.isStarred = true;
        filter.isTrash = false;
        break;
      case 'drafts':
        filter.sender = queryEmail;
        filter.isTrash = false;
        filter.isDraft = true;
        break;
      case 'bin':
        filter.isTrash = true;
        break;
      case 'all':
      default:
        filter.isTrash = false;
        filter.isDraft = false;
        break;
    }

    const emails = await Email.find(filter).sort({ timestamp: -1 }).lean();
    return res.status(200).json(await addSenderNames(emails));
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
      isTrash: false
    }).sort({ timestamp: -1 }).lean();

    return res.status(200).json(await addSenderNames(emails));
  } catch (err) {
    console.error('Fetch starred emails error:', err);
    return res.status(500).json({ message: 'Internal server error while fetching starred emails' });
  }
}

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

module.exports = {
  createEmail,
  getEmails,
  getStarredEmails,
  starEmail,
  unstarEmail,
  toggleStarredEmail,
  updateEmail,
  deleteEmail
};