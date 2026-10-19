const express = require('express');
const labelController = require('../controllers/labelController');
const { requireTokenAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireTokenAuth);
router.get('/', labelController.listLabels);
router.post('/', labelController.createLabel);
router.patch('/:id', labelController.renameLabel);
router.delete('/:id', labelController.deleteLabel);

module.exports = router;
