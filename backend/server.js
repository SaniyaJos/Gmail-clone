const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const User = require('./models/User');
const emailRoutes = require('./routes/emailRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allow cross-origin requests (e.g. from local html files)
app.use(express.json()); // Parse JSON payloads
app.use('/api/emails', emailRoutes);

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

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
