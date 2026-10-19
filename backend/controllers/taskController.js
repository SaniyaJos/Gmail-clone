/**
 * Task Controller - Email-to-Action Engine
 *
 * Handles AI-powered action extraction from emails, duplicate prevention,
 * task retrieval, completion status toggling, and linking to original emails.
 */

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Email = require('../models/Email');
const User = require('../models/User');
const { extractActionsFromEmail } = require('../services/aiService');

/**
 * Formats a user's full name (firstName + lastName) nicely capitalized.
 */
function formatUserFullName(user, fallbackEmail) {
  if (user) {
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    if (full) {
      return full
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  if (!fallbackEmail) return 'Unknown';
  const username = fallbackEmail.split('@')[0] || '';
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/**
 * POST /api/tasks/extract
 * Extracts actionable tasks from an email using Gemini AI.
 * 
 * Body: { emailId, forceRefresh?: boolean }
 */
async function extractActions(req, res) {
  try {
    const { emailId, forceRefresh } = req.body;
    const userEmail = req.user.email;

    if (!emailId || !mongoose.isValidObjectId(emailId)) {
      return res.status(400).json({ message: 'A valid emailId is required' });
    }

    // 1. Fetch the target email
    const email = await Email.findById(emailId);
    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // 2. Authorization check: Ensure user owns or participated in this email
    const isOwner = email.owner && email.owner.toLowerCase() === userEmail;
    const isReceiver = email.receiver && email.receiver.toLowerCase() === userEmail;
    const isSender = email.sender && email.sender.toLowerCase() === userEmail;

    if (!isOwner && !isReceiver && !isSender) {
      return res.status(403).json({
        message: 'Forbidden: You are not authorized to analyze this email'
      });
    }

    // 3. Deduplication check: Check if tasks already exist for this email and user
    const existingTasks = await Task.find({ emailId, userEmail }).sort({ createdAt: -1 });

    if (existingTasks.length > 0) {
      if (!forceRefresh) {
        return res.status(200).json({
          message: 'Retrieved existing actionable tasks for this email',
          tasks: existingTasks,
          alreadyExtracted: true,
          count: existingTasks.length
        });
      } else {
        // When force re-analyzing, remove previous extraction to replace with updated perspective
        await Task.deleteMany({ emailId, userEmail });
      }
    }

    // 4. Look up user profiles for First Name + Last Name
    const involvedUsers = await User.find({
      email: { $in: [email.sender.toLowerCase(), email.receiver.toLowerCase()] }
    }, 'email firstName lastName').lean();

    const nameMap = new Map(
      involvedUsers.map(u => [u.email.toLowerCase(), formatUserFullName(u, u.email)])
    );

    const senderDisplayName = nameMap.get(email.sender.toLowerCase()) || formatUserFullName(null, email.sender);
    const receiverDisplayName = nameMap.get(email.receiver.toLowerCase()) || formatUserFullName(null, email.receiver);

    // 5. Call Gemini AI extraction service
    console.log(`[AI Extraction] Analyzing email "${email.subject}" (${email._id}) for user ${userEmail} (Sender: ${senderDisplayName}, Recipient: ${receiverDisplayName})`);
    const extractedList = await extractActionsFromEmail({
      subject: email.subject,
      body: email.body,
      sender: email.sender,
      receiver: email.receiver,
      userEmail,
      senderName: senderDisplayName,
      receiverName: receiverDisplayName
    });

    if (!extractedList || extractedList.length === 0) {
      return res.status(200).json({
        message: 'No actionable tasks found in this email',
        tasks: existingTasks, // Keep any pre-existing tasks
        count: 0
      });
    }

    // 5. Deduplicate against existing tasks by title comparison
    const existingTitles = new Set(
      existingTasks.map(t => t.title.toLowerCase().trim())
    );

    const tasksToInsert = [];
    for (const item of extractedList) {
      const normalizedTitle = item.title.toLowerCase().trim();
      if (!existingTitles.has(normalizedTitle)) {
        existingTitles.add(normalizedTitle);
        tasksToInsert.push({
          userEmail,
          emailId: email._id,
          emailSubject: email.subject || '(No Subject)',
          title: item.title,
          description: item.description || '',
          deadline: item.deadline || null,
          priority: item.priority || 'Medium',
          reason: item.reason || '',
          status: 'Pending'
        });
      }
    }

    let newlyCreated = [];
    if (tasksToInsert.length > 0) {
      newlyCreated = await Task.insertMany(tasksToInsert);
    }

    // 6. Return combined tasks for this email
    const allEmailTasks = await Task.find({ emailId, userEmail }).sort({ createdAt: -1 });

    return res.status(201).json({
      message: newlyCreated.length > 0 
        ? `Successfully extracted ${newlyCreated.length} actionable task(s)`
        : 'Tasks already up to date',
      tasks: allEmailTasks,
      count: newlyCreated.length,
      alreadyExtracted: false
    });

  } catch (err) {
    console.error('Task extraction error:', err);
    const statusCode = err.statusCode || (err.message && err.message.includes('API key') ? 503 : 500);
    return res.status(statusCode).json({
      message: err.message || 'Failed to extract actions from email',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

/**
 * GET /api/tasks
 * Retrieves tasks for the authenticated user with optional status/priority filtering.
 * Query params: status (Pending|Completed|All), priority (High|Medium|Low), emailId
 */
async function getTasks(req, res) {
  try {
    const userEmail = req.user.email;
    const { status, priority, emailId } = req.query;

    const filter = { userEmail };

    if (status && ['Pending', 'Completed'].includes(status)) {
      filter.status = status;
    }

    if (priority && ['High', 'Medium', 'Low'].includes(priority)) {
      filter.priority = priority;
    }

    if (emailId && mongoose.isValidObjectId(emailId)) {
      filter.emailId = emailId;
    }

    // Populate email summary to display original email reference
    const tasks = await Task.find(filter)
      .populate({
        path: 'emailId',
        select: 'subject sender receiver timestamp isTrash isSpam'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich emailId with senderName and receiverName (firstName + lastName)
    const involvedEmails = new Set();
    tasks.forEach(t => {
      if (t.emailId) {
        if (!t.emailSubject && t.emailId.subject) {
          t.emailSubject = t.emailId.subject;
        }
        t.isEmailDeleted = false;
        t.isEmailInTrash = Boolean(t.emailId.isTrash);
        t.isEmailSpam = Boolean(t.emailId.isSpam);

        if (t.emailId.sender) involvedEmails.add(t.emailId.sender.toLowerCase());
        if (t.emailId.receiver) involvedEmails.add(t.emailId.receiver.toLowerCase());
      } else {
        t.isEmailDeleted = true;
        t.isEmailInTrash = false;
        t.isEmailSpam = false;
      }
    });

    if (involvedEmails.size > 0) {
      const users = await User.find({ email: { $in: Array.from(involvedEmails) } }, 'email firstName lastName').lean();
      const userMap = new Map(users.map(u => [u.email.toLowerCase(), formatUserFullName(u, u.email)]));

      tasks.forEach(t => {
        if (t.emailId) {
          t.emailId.senderName = userMap.get(t.emailId.sender?.toLowerCase()) || formatUserFullName(null, t.emailId.sender);
          t.emailId.receiverName = userMap.get(t.emailId.receiver?.toLowerCase()) || formatUserFullName(null, t.emailId.receiver);
        }
      });
    }

    return res.status(200).json(tasks);
  } catch (err) {
    console.error('Fetch tasks error:', err);
    return res.status(500).json({ message: 'Internal server error while fetching tasks' });
  }
}

/**
 * PATCH /api/tasks/:id
 * Updates task status (Pending <-> Completed) or details.
 */
async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Authorization check
    if (task.userEmail.toLowerCase() !== userEmail) {
      return res.status(403).json({ message: 'Forbidden: You cannot modify this task' });
    }

    const allowedUpdates = ['status', 'title', 'description', 'deadline', 'priority'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'status') {
          if (!['Pending', 'Completed'].includes(req.body.status)) return;
          task.status = req.body.status;
          task.completedAt = req.body.status === 'Completed' ? new Date() : null;
        } else if (field === 'priority') {
          if (['High', 'Medium', 'Low'].includes(req.body.priority)) {
            task.priority = req.body.priority;
          }
        } else if (field === 'deadline') {
          task.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
        } else {
          task[field] = req.body[field];
        }
      }
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate({
        path: 'emailId',
        select: 'subject sender receiver timestamp isTrash'
      })
      .lean();

    return res.status(200).json({
      message: 'Task updated successfully',
      task: populatedTask
    });
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ message: 'Internal server error while updating task' });
  }
}

/**
 * DELETE /api/tasks/:id
 * Deletes a task.
 */
async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.userEmail.toLowerCase() !== userEmail) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete this task' });
    }

    await Task.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Task deleted successfully', id });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ message: 'Internal server error while deleting task' });
  }
}

/**
 * GET /api/tasks/:id/email
 * Fetches the original email for a given task.
 */
async function getTaskEmail(req, res) {
  try {
    const { id } = req.params;
    const userEmail = req.user.email;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.userEmail.toLowerCase() !== userEmail) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const email = await Email.findById(task.emailId);
    if (!email) {
      return res.status(404).json({ message: 'Original email no longer exists' });
    }

    return res.status(200).json({ email });
  } catch (err) {
    console.error('Get task email error:', err);
    return res.status(500).json({ message: 'Internal server error while retrieving task email' });
  }
}

module.exports = {
  extractActions,
  getTasks,
  updateTask,
  deleteTask,
  getTaskEmail
};
