const multer = require('multer');
const path = require('path');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_ATTACHMENTS
  },
  fileFilter(req, file, callback) {
    const acceptedExtensions = ALLOWED_TYPES[file.mimetype];
    const extension = path.extname(file.originalname).toLowerCase();

    if (!acceptedExtensions || !acceptedExtensions.includes(extension)) {
      return callback(new Error('Unsupported file type. Attach PDF, common image, text, CSV, ZIP, or Office files.'));
    }
    callback(null, true);
  }
});

function receiveAttachments(req, res, next) {
  upload.array('attachments', MAX_ATTACHMENTS)(req, res, err => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Each attachment must be 10 MB or smaller.' });
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: `You can attach up to ${MAX_ATTACHMENTS} files.` });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'Could not process the uploaded files.' });
    }
    if (err.message.startsWith('Unsupported file type.')) {
      return res.status(415).json({ message: err.message });
    }
    return next(err);
  });
}

module.exports = {
  MAX_ATTACHMENTS,
  receiveAttachments
};
