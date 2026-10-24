const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Email = require('../models/Email');

const ATTACHMENT_DIRECTORY = path.join(__dirname, '..', 'uploads');
const STORAGE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let gridFSBucket = null;

function getGridFSBucket() {
  if (!gridFSBucket) {
    if (!mongoose.connection || !mongoose.connection.db) {
      throw new Error('Database not connected yet');
    }
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'attachments'
    });
  }
  return gridFSBucket;
}

function getAttachmentPath(storageName) {
  if (typeof storageName !== 'string' || !STORAGE_NAME_PATTERN.test(storageName)) {
    throw new Error('Invalid attachment storage reference');
  }
  return path.join(ATTACHMENT_DIRECTORY, storageName);
}

/**
 * Saves uploaded files into MongoDB GridFS (and caches to local disk).
 * Returns array of { filename, mimeType, size, storageName }
 */
async function saveUploadedFiles(files) {
  const bucket = getGridFSBucket();
  const savedAttachments = [];

  for (const file of files) {
    const safeOriginalName = path.posix.basename(file.originalname.replace(/\\/g, '/'))
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 255);

    const storageName = randomUUID();
    const attachment = {
      filename: safeOriginalName || 'attachment',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      storageName
    };

    // 1. Upload to MongoDB GridFS in cloud
    await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(storageName, {
        contentType: attachment.mimeType,
        metadata: {
          filename: attachment.filename,
          size: attachment.size,
          uploadedAt: new Date()
        }
      });
      uploadStream.end(file.buffer);
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    // 2. Also keep a local copy on disk if possible
    try {
      await fs.mkdir(ATTACHMENT_DIRECTORY, { recursive: true });
      await fs.writeFile(getAttachmentPath(storageName), file.buffer, {
        flag: 'wx',
        mode: 0o600
      });
    } catch {
      // Local disk cache is non-blocking; GridFS in MongoDB Atlas is primary
    }

    savedAttachments.push(attachment);
  }

  return savedAttachments;
}

/**
 * Opens a readable stream for the attachment.
 * First checks MongoDB GridFS, then falls back to local disk.
 * Returns { stream, mimeType, length, filename } or null if not found.
 */
async function openAttachmentReadStream(storageName) {
  if (typeof storageName !== 'string' || !STORAGE_NAME_PATTERN.test(storageName)) {
    return null;
  }

  // 1. Check local disk cache first for sub-millisecond response
  const localPath = getAttachmentPath(storageName);
  try {
    const stat = await fs.stat(localPath);
    if (stat.isFile() && stat.size > 0) {
      const stream = fsSync.createReadStream(localPath);
      return {
        stream,
        mimeType: 'application/octet-stream',
        length: stat.size,
        filename: storageName
      };
    }
  } catch {
    // Not cached locally yet, stream from GridFS
  }

  // 2. Stream from MongoDB GridFS in cloud and cache to local disk
  try {
    const bucket = getGridFSBucket();
    const files = await bucket.find({ filename: storageName }).limit(1).toArray();
    if (files && files.length > 0) {
      const fileDoc = files[0];
      const stream = bucket.openDownloadStream(fileDoc._id);

      // Asynchronously cache file to local disk for instant subsequent downloads
      try {
        await fs.mkdir(ATTACHMENT_DIRECTORY, { recursive: true });
        const cacheStream = fsSync.createWriteStream(localPath);
        bucket.openDownloadStream(fileDoc._id).pipe(cacheStream);
      } catch {
        // Non-fatal if local cache write fails
      }

      return {
        stream,
        mimeType: fileDoc.contentType || fileDoc.metadata?.mimeType || 'application/octet-stream',
        length: fileDoc.length,
        filename: fileDoc.metadata?.filename || fileDoc.filename
      };
    }
  } catch (gridFsErr) {
    console.error('GridFS read error:', gridFsErr.message);
  }

  return null;
}

/**
 * Deletes unreferenced attachments from both GridFS and local disk.
 */
async function removeUnreferencedAttachments(storageNames) {
  const uniqueNames = [...new Set(storageNames)].filter(name => STORAGE_NAME_PATTERN.test(name));
  if (uniqueNames.length === 0) return;

  const referencedAttachments = await Email.distinct('attachments.storageName', {
    'attachments.storageName': { $in: uniqueNames }
  });
  const referencedSet = new Set(referencedAttachments);
  const unusedNames = uniqueNames.filter(name => !referencedSet.has(name));
  if (unusedNames.length === 0) return;

  // 1. Delete from GridFS
  try {
    const bucket = getGridFSBucket();
    for (const name of unusedNames) {
      const files = await bucket.find({ filename: name }).toArray();
      for (const file of files) {
        await bucket.delete(file._id).catch(() => {});
      }
    }
  } catch (gridFsErr) {
    console.error('Failed to remove unused attachment from GridFS:', gridFsErr.message);
  }

  // 2. Delete from local disk
  for (const name of unusedNames) {
    try {
      await fs.unlink(getAttachmentPath(name));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to remove local attachment file:', err.message);
      }
    }
  }
}

/**
 * Auto-syncs any local uploads on this laptop to GridFS in MongoDB Atlas.
 * This runs when the server boots, ensuring any teammate's local files get uploaded to the cloud.
 */
async function syncLocalUploadsToGridFS() {
  try {
    if (!fsSync.existsSync(ATTACHMENT_DIRECTORY)) return;
    const localFiles = await fs.readdir(ATTACHMENT_DIRECTORY);
    const validNames = localFiles.filter(name => STORAGE_NAME_PATTERN.test(name));
    if (validNames.length === 0) return;

    const bucket = getGridFSBucket();
    for (const name of validNames) {
      const existing = await bucket.find({ filename: name }).limit(1).toArray();
      if (existing.length === 0) {
        const filePath = path.join(ATTACHMENT_DIRECTORY, name);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const email = await Email.findOne({ 'attachments.storageName': name }, 'attachments').lean();
          const att = email?.attachments?.find(a => a.storageName === name);
          const uploadStream = bucket.openUploadStream(name, {
            contentType: att?.mimeType || 'application/octet-stream',
            metadata: {
              filename: att?.filename || 'attachment',
              size: stat.size,
              syncedAt: new Date()
            }
          });
          fsSync.createReadStream(filePath).pipe(uploadStream);
          await new Promise((res, rej) => {
            uploadStream.on('finish', res);
            uploadStream.on('error', rej);
          });
          console.log(`[GridFS Sync] Synced local attachment ${att?.filename || name} to GridFS.`);
        }
      }
    }
  } catch (err) {
    console.warn('[GridFS Sync] Note:', err.message);
  }
}

module.exports = {
  STORAGE_NAME_PATTERN,
  getAttachmentPath,
  saveUploadedFiles,
  openAttachmentReadStream,
  removeUnreferencedAttachments,
  syncLocalUploadsToGridFS
};
