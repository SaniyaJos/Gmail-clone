const express = require('express');
const taskController = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authorization middleware to all task routes
router.use(requireAuth);

router.post('/extract', taskController.extractActions);
router.get('/', taskController.getTasks);
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.get('/:id/email', taskController.getTaskEmail);

module.exports = router;
