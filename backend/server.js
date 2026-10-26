/**
 * Express Server for InboxFlow (Gmail Clone)
 * Handles MongoDB Atlas connection, user authentication endpoints,
 * and delegates email routes to modular routers.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./models/User');
const emailRoutes = require('./routes/emailRoutes');
const taskRoutes = require('./routes/taskRoutes');
const labelRoutes = require('./routes/labelRoutes');
const { startCleanupScheduler } = require('./services/cleanupService');
const { syncLocalUploadsToGridFS } = require('./services/attachmentStorage');

// ==========================================
// 1. APP INITIALIZATION & CONFIGURATION
// ==========================================
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: MONGODB_URI is not defined in the environment variables (.env file)!');
  process.exit(1);
}
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('CRITICAL ERROR: JWT_SECRET must be set to a random value of at least 32 characters in backend/.env!');
  process.exit(1);
}

// ==========================================
// 2. MIDDLEWARE PIPELINE
// ==========================================
app.use(cors()); // Allow cross-origin requests from frontend HTML files
app.use(express.json()); // Parse JSON request bodies
app.use('/api/emails', emailRoutes); // Mount modular email CRUD & search routes
app.use('/api/tasks', taskRoutes); // Mount Email-to-Action Engine task routes
app.use('/api/labels', labelRoutes);

// ==========================================
// 3. DATABASE CONNECTION
// ==========================================
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas cluster!');
    // Auto-delete Bin/Spam emails older than 30 days (runs now, then hourly)
    startCleanupScheduler();
    // Sync any local disk uploads to MongoDB GridFS so all team members can access them
    syncLocalUploadsToGridFS();
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB Atlas:', err.message);
  });

// ==========================================
// 4. AUTHENTICATION & HEALTH API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'InboxFlow backend is running smoothly' });
});

// Check if Username/Email already exists in MongoDB
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

    if (!firstName || !email || !password) {
      return res.status(400).json({ message: 'First name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'That username is taken. Try another.' });
    }

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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Couldn't find your InboxFlow account" });
    }

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
        email: user.email,
        token: jwt.sign({ email: user.email }, JWT_SECRET, {
          algorithm: 'HS256',
          expiresIn: '8h',
          issuer: 'inboxflow'
        })
      }
    });

  } catch (err) {
    console.error('Sign-in error:', err);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
});

// Delete Account & All User Data Endpoint
app.delete('/api/account', async (req, res) => {
  try {
    const authorization = req.headers.authorization || '';
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch ? tokenMatch[1] : (req.query.token || null);
    let targetEmail = '';

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: 'inboxflow'
        });
        if (payload && payload.email) {
          targetEmail = payload.email.trim().toLowerCase();
        }
      } catch (e) { }
    }

    if (!targetEmail) {
      const headerEmail = req.headers['x-user-email'] || req.body?.email || req.query?.email;
      if (headerEmail && typeof headerEmail === 'string' && headerEmail.trim()) {
        targetEmail = headerEmail.trim().toLowerCase();
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ message: 'Authentication required to delete account' });
    }

    const Email = require('./models/Email');
    const Task = require('./models/Task');
    const Label = require('./models/Label');
    const SpamPreference = require('./models/SpamPreference');

    // 1. Delete emails where owner is the deleted user AND receiver is the deleted user
    // (or sent/drafted by this user). Strictly enforcing owner: targetEmail guarantees
    // that other users' copies (e.g., messages they sent to this person) remain safely in their Sent list.
    const escapedEmail = targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const receiverRegex = new RegExp(`(^|,\\s*)${escapedEmail}(\\s*,|$)`, 'i');

    const deletedEmails = await Email.deleteMany({
      owner: targetEmail,
      $or: [
        { receiver: targetEmail },
        { receiver: receiverRegex },
        { sender: targetEmail }
      ]
    });

    // 2. Delete all tasks created for this user
    const deletedTasks = await Task.deleteMany({ userEmail: targetEmail });

    // 3. Delete all custom labels owned by this user
    const deletedLabels = await Label.deleteMany({ owner: targetEmail });

    // 4. Delete spam preferences
    const deletedPrefs = await SpamPreference.deleteMany({ owner: targetEmail });

    // 5. Delete the User account
    const deletedUser = await User.deleteOne({ email: targetEmail });

    console.log(`[Account Deleted] User ${targetEmail} and all personal data permanently deleted (emails: ${deletedEmails.deletedCount}, tasks: ${deletedTasks.deletedCount}, labels: ${deletedLabels.deletedCount}).`);

    return res.status(200).json({
      message: 'Account and all associated emails successfully deleted',
      deletedCounts: {
        emails: deletedEmails.deletedCount,
        tasks: deletedTasks.deletedCount,
        labels: deletedLabels.deletedCount,
        user: deletedUser.deletedCount
      }
    });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ message: 'Internal server error while deleting account' });
  }
});
// backend/server.js (Add right above app.listen)
const path = require('path');

// 1. Serve static files from the compiled React Vite build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 2. Any request that does NOT match an /api route gets sent to React's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ==========================================
// 5. SERVER STARTUP & LISTEN
// ==========================================
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});