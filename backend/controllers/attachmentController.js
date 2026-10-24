const mongoose = require('mongoose');
const Email = require('../models/Email');
const {
  openAttachmentReadStream,
  removeUnreferencedAttachments,
  saveUploadedFiles
} = require('../services/attachmentStorage');
const { MAX_ATTACHMENTS } = require('../middleware/attachmentUpload');

async function findOwnedEmail(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Invalid email ID' });
    return null;
  }

  const email = await Email.findOne({
    _id: req.params.id,
    owner: req.user.email
  });
  if (!email) {
    res.status(404).json({ message: 'Email not found' });
    return null;
  }
  return email;
}

async function uploadAttachments(req, res) {
  let savedAttachments = [];
  try {
    const draft = await findOwnedEmail(req, res);
    if (!draft) return;
    if (!draft.isDraft || draft.sender !== req.user.email) {
      return res.status(403).json({ message: 'Attachments can only be added to your own draft.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Choose at least one file to upload.' });
    }
    if (draft.attachments.length + req.files.length > MAX_ATTACHMENTS) {
      return res.status(400).json({ message: `A draft can contain up to ${MAX_ATTACHMENTS} attachments.` });
    }

    savedAttachments = await saveUploadedFiles(req.files);
    draft.attachments.push(...savedAttachments);
    await draft.save();

    return res.status(201).json({
      message: 'Attachments uploaded successfully',
      attachments: draft.attachments
    });
  } catch (err) {
    if (savedAttachments.length > 0) {
      try {
        await removeUnreferencedAttachments(savedAttachments.map(attachment => attachment.storageName));
      } catch (cleanupError) {
        console.error('Attachment upload rollback failed:', cleanupError.message);
      }
    }
    console.error('Upload attachments error:', err);
    return res.status(500).json({ message: 'Could not save the uploaded attachments.' });
  }
}

async function getAuthorizedAttachment(req, res) {
  if (!mongoose.isValidObjectId(req.params.attachmentId)) {
    res.status(400).json({ message: 'Invalid attachment ID' });
    return null;
  }
  const email = await findOwnedEmail(req, res);
  if (!email) return null;

  const attachment = email.attachments.id(req.params.attachmentId);
  if (!attachment) {
    res.status(404).json({ message: 'Attachment not found' });
    return null;
  }
  return { email, attachment };
}

async function downloadAttachment(req, res) {
  try {
    const authorized = await getAuthorizedAttachment(req, res);
    if (!authorized) return;
    const { attachment } = authorized;

    const streamInfo = await openAttachmentReadStream(attachment.storageName);
    if (!streamInfo) {
      return res.status(404).json({ message: 'The attachment file is no longer available.' });
    }

    const safeFilename = (attachment.filename || 'attachment').replace(/["\r\n]/g, '_');
    const encodedFilename = encodeURIComponent(safeFilename);

    res.set({
      'Content-Type': attachment.mimeType || streamInfo.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
      'X-Content-Type-Options': 'nosniff'
    });
    if (streamInfo.length) {
      res.set('Content-Length', streamInfo.length);
    }

    streamInfo.stream.on('error', err => {
      console.error('Attachment download stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Could not download the attachment.' });
      }
    });

    streamInfo.stream.pipe(res);
  } catch (err) {
    console.error('Download attachment error:', err);
    return res.status(500).json({ message: 'Could not download the attachment.' });
  }
}

async function previewAttachment(req, res) {
  try {
    const authorized = await getAuthorizedAttachment(req, res);
    if (!authorized) return;
    const { attachment } = authorized;

    const previewable = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
      'text/plain', 'text/csv'
    ];
    if (!previewable.includes(attachment.mimeType)) {
      return res.status(415).json({ message: 'This file type cannot be previewed.' });
    }

    const streamInfo = await openAttachmentReadStream(attachment.storageName);
    if (!streamInfo) {
      return res.status(404).json({ message: 'The attachment file is no longer available.' });
    }

    const safeFilename = (attachment.filename || 'attachment').replace(/["\r\n]/g, '_');
    res.set({
      'Content-Type': attachment.mimeType || streamInfo.mimeType,
      'Content-Disposition': `inline; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff'
    });
    if (streamInfo.length) {
      res.set('Content-Length', streamInfo.length);
    }

    streamInfo.stream.on('error', err => {
      console.error('Attachment preview stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Could not preview the attachment.' });
      }
    });

    streamInfo.stream.pipe(res);
  } catch (err) {
    console.error('Preview attachment error:', err);
    return res.status(500).json({ message: 'Could not preview the attachment.' });
  }
}

async function removeDraftAttachment(req, res) {
  try {
    const authorized = await getAuthorizedAttachment(req, res);
    if (!authorized) return;
    const { email, attachment } = authorized;
    if (!email.isDraft || email.sender !== req.user.email) {
      return res.status(403).json({ message: 'Only attachments in your own draft can be removed.' });
    }

    const removedStorageName = attachment.storageName;
    email.attachments.pull(attachment._id);
    await email.save();
    await removeUnreferencedAttachments([removedStorageName]);

    return res.status(200).json({
      message: 'Attachment removed',
      attachments: email.attachments
    });
  } catch (err) {
    console.error('Remove draft attachment error:', err);
    return res.status(500).json({ message: 'Could not remove the attachment.' });
  }
}

module.exports = {
  uploadAttachments,
  downloadAttachment,
  previewAttachment,
  removeDraftAttachment
};
