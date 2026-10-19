const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const Email = require('../models/Email');

const ATTACHMENT_DIRECTORY = path.join(__dirname, '..', 'uploads');
const STORAGE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAttachmentPath(storageName) {
  if (typeof storageName !== 'string' || !STORAGE_NAME_PATTERN.test(storageName)) {
    throw new Error('Invalid attachment storage reference');
  }
  return path.join(ATTACHMENT_DIRECTORY, storageName);
}

async function saveUploadedFiles(files) {
  await fs.mkdir(ATTACHMENT_DIRECTORY, { recursive: true });
  const savedAttachments = [];

  try {
    for (const file of files) {
      const safeOriginalName = path.posix.basename(file.originalname.replace(/\\/g, '/'))
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 255);
      const attachment = {
        filename: safeOriginalName || 'attachment',
        mimeType: file.mimetype,
        size: file.size,
        storageName: randomUUID()
      };

      await fs.writeFile(getAttachmentPath(attachment.storageName), file.buffer, {
        flag: 'wx',
        mode: 0o600
      });
      savedAttachments.push(attachment);
    }
    return savedAttachments;
  } catch (err) {
    const cleanupResults = await Promise.allSettled(
      savedAttachments.map(attachment => fs.unlink(getAttachmentPath(attachment.storageName)))
    );
    cleanupResults.forEach(result => {
      if (result.status === 'rejected' && result.reason.code !== 'ENOENT') {
        console.error('Failed to clean up an incomplete attachment upload:', result.reason.message);
      }
    });
    throw err;
  }
}

async function removeUnreferencedAttachments(storageNames) {
  const uniqueNames = [...new Set(storageNames)].filter(name => STORAGE_NAME_PATTERN.test(name));
  if (uniqueNames.length === 0) return;

  const referencedAttachments = await Email.distinct('attachments.storageName', {
    'attachments.storageName': { $in: uniqueNames }
  });
  const referencedSet = new Set(referencedAttachments);
  const unusedNames = uniqueNames.filter(name => !referencedSet.has(name));

  const results = await Promise.allSettled(
    unusedNames.map(name => fs.unlink(getAttachmentPath(name)))
  );
  const failed = results.filter(result => result.status === 'rejected' && result.reason.code !== 'ENOENT');
  if (failed.length > 0) {
    failed.forEach(result => console.error('Failed to remove an unused attachment:', result.reason.message));
    throw new Error(`Failed to remove ${failed.length} unused attachment file(s)`);
  }
}

module.exports = {
  STORAGE_NAME_PATTERN,
  getAttachmentPath,
  saveUploadedFiles,
  removeUnreferencedAttachments
};
