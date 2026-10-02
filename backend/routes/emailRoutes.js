const express = require('express');
const emailController = require('../controllers/emailController');

const router = express.Router();

router.post('/', emailController.createEmail);
router.get('/starred', emailController.getStarredEmails);
router.get('/', emailController.getEmails);
router.patch('/:id/star', emailController.starEmail);
router.patch('/:id/unstar', emailController.unstarEmail);
router.patch('/:id/toggle-starred', emailController.toggleStarredEmail);
router.patch('/:id', emailController.updateEmail);
router.delete('/:id', emailController.deleteEmail);

module.exports = router;