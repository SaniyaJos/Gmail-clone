const express = require('express');
const emailController = require('../controllers/emailController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', emailController.createEmail);
router.get('/starred', emailController.getStarredEmails);
router.get('/counts', requireAuth, emailController.getFolderCounts);
router.get('/', emailController.getEmails);
router.delete('/folder/:folder/empty', requireAuth, emailController.emptyFolder);
router.patch('/:id/star', emailController.starEmail);
router.patch('/:id/unstar', emailController.unstarEmail);
router.patch('/:id/toggle-starred', emailController.toggleStarredEmail);
router.patch('/:id/draft', emailController.updateDraft);
router.patch('/:id/report-spam', requireAuth, emailController.reportSpam);
router.patch('/:id/not-spam', requireAuth, emailController.markNotSpam);
router.patch('/:id', emailController.updateEmail);
router.delete('/:id', emailController.deleteEmail);

module.exports = router;