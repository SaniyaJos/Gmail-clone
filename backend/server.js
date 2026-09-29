const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const Email = require('./models/Email');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allow cross-origin requests (e.g. from local html files)
app.use(express.json()); // Parse JSON payloads

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI is not defined in the environment variables (.env file)!');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas cluster!');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB Atlas:', err.message);
  });

// API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'InboxFlow backend is running smoothly' });
});

// Check if Email/Username already exists in MongoDB
app.post('/api/check-username', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.json({ exists: true });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ message: 'Internal server error while checking username' });
  }
});

// Create Account (Signup) Endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, dobDay, dobMonth, dobYear } = req.body;

    // Simple backend validation
    if (!firstName || !email || !password) {
      return res.status(400).json({ message: 'First name, email, and password are required' });
    }

    // Check if email already exists in MongoDB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'That username is taken. Try another.' });
    }

    // Create a new user document
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      dobDay,
      dobMonth,
      dobYear
    });

    await newUser.save();
    console.log(`[Success] Registered new account: ${email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        email: newUser.email
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error during account registration' });
  }
});

// Sign-in (Login) Endpoint
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Couldn't find your InboxFlow account" });
    }

    // Validate password (plain text match)
    if (user.password !== password) {
      return res.status(401).json({ message: 'Wrong password. Try again.' });
    }

    console.log(`[Success] User signed in: ${email}`);

    res.status(200).json({
      message: 'Authentication successful',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Sign-in error:', err);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
});

// ================= EMAIL API ROUTES =================

// Create / Send / Draft Email Endpoint
app.post('/api/emails', async (req, res) => {
  try {
    const { sender, receiver, subject, body, isDraft } = req.body;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'Sender and Receiver are required' });
    }

    let savedEmail;

    if (isDraft) {
      // Drafts are only owned by and visible to the sender (creator)
      savedEmail = new Email({
        owner: sender.toLowerCase(),
        sender,
        receiver,
        subject: subject || '(No Subject)',
        body: body || '',
        isDraft: true
      });
      await savedEmail.save();
      console.log(`[Draft Success] Saved draft for ${sender} (receiver: ${receiver})`);
    } else {
      if (sender.toLowerCase() === receiver.toLowerCase()) {
        // Self-send edge case: save a single document copy owned by the sender
        const selfCopy = new Email({
          owner: sender.toLowerCase(),
          sender,
          receiver,
          subject: subject || '(No Subject)',
          body: body || '',
          isDraft: false,
          isRead: false // Keep unread initially in Inbox view
        });
        await selfCopy.save();
        savedEmail = selfCopy;
        console.log(`[Email Success] Saved single self-send email copy for ${sender}`);
      } else {
        // Store copy for the sender's sent folder
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

        // Store copy for the recipient's inbox folder
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
        console.log(`[Email Success] Saved separate copies of email from ${sender} to ${receiver}`);
      }
    }

    res.status(201).json({
      message: isDraft ? 'Draft saved successfully' : 'Email sent successfully',
      email: savedEmail
    });

  } catch (err) {
    console.error('Save email error:', err);
    res.status(500).json({ message: 'Internal server error while saving email' });
  }
});

// Retrieve Emails by Folder Endpoint
app.get('/api/emails', async (req, res) => {
  try {
    const { email, folder } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'User email query parameter is required' });
    }

    const queryEmail = email.toLowerCase();
    let filter = { owner: queryEmail };

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

    // Fetch emails, sorted by timestamp descending (newest first)
    const emails = await Email.find(filter).sort({ timestamp: -1 }).lean();

    // Look up sender names
    const senderEmails = [...new Set(emails.map(e => e.sender))];
    const senders = await User.find({ email: { $in: senderEmails } }, 'email firstName').lean();

    const senderMap = {};
    senders.forEach(user => {
      senderMap[user.email] = user.firstName;
    });

    const enrichedEmails = emails.map(email => ({
      ...email,
      firstName: senderMap[email.sender] || null
    }));

    res.status(200).json(enrichedEmails);

  } catch (err) {
    console.error('Fetch emails error:', err);
    res.status(500).json({ message: 'Internal server error while fetching emails' });
  }
});

// Toggle Status Flags Endpoint (Star, Read/Unread, Move to Bin)
app.patch('/api/emails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = {};

    // Only allow updating specific flags
    const allowedUpdates = ['isStarred', 'isRead', 'isTrash', 'isDraft'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    const email = await Email.findByIdAndUpdate(id, updateFields, { new: true });
    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    res.status(200).json({ message: 'Email updated successfully', email });

  } catch (err) {
    console.error('Update email status error:', err);
    res.status(500).json({ message: 'Internal server error while updating email status' });
  }
});

// Delete Email Permanently Endpoint (from Trash/Bin only)
app.delete('/api/emails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const email = await Email.findByIdAndDelete(id);
    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    res.status(200).json({ message: 'Email permanently deleted' });

  } catch (err) {
    console.error('Delete email error:', err);
    res.status(500).json({ message: 'Internal server error while deleting email' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
