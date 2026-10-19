const express = require('express');
const emailController = require('../controllers/emailController');
const attachmentController = require('../controllers/attachmentController');
const { requireAuth, requireTokenAuth } = require('../middleware/authMiddleware');
const { receiveAttachments } = require('../middleware/attachmentUpload');
const labelController = require('../controllers/labelController');

const router = express.Router();

router.post('/', requireTokenAuth, emailController.createEmail);
router.post('/:id/undo-send', requireTokenAuth, emailController.undoSendEmail);
router.post('/:id/attachments', requireTokenAuth, receiveAttachments, attachmentController.uploadAttachments);
router.get('/:id/attachments/:attachmentId/download', requireTokenAuth, attachmentController.downloadAttachment);
router.get('/:id/attachments/:attachmentId/preview', requireTokenAuth, attachmentController.previewAttachment);
router.delete('/:id/attachments/:attachmentId', requireTokenAuth, attachmentController.removeDraftAttachment);
router.get('/starred', emailController.getStarredEmails);
router.patch('/bulk-labels', requireTokenAuth, labelController.updateEmailLabels);
router.patch('/:emailId/labels', requireTokenAuth, labelController.updateEmailLabels);
router.get('/counts', requireAuth, emailController.getFolderCounts);
router.get('/:id/thread', requireAuth, emailController.getEmailThread);
router.get('/:id', requireAuth, emailController.getEmailById);
router.get('/', (req, res, next) => {
  if (req.query.labelId) return requireTokenAuth(req, res, next);
  return next();
}, emailController.getEmails);
router.delete('/folder/:folder/empty', requireAuth, emailController.emptyFolder);
router.patch('/:id/star', emailController.starEmail);
router.patch('/:id/unstar', emailController.unstarEmail);
router.patch('/:id/toggle-starred', emailController.toggleStarredEmail);
router.patch('/:id/draft', requireTokenAuth, emailController.updateDraft);
router.patch('/:id/report-spam', requireAuth, emailController.reportSpam);
router.patch('/:id/not-spam', requireAuth, emailController.markNotSpam);
router.patch('/:id', emailController.updateEmail);
router.delete('/:id', emailController.deleteEmail);

module.exports = router;