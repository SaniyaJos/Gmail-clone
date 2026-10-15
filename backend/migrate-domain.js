/**
 * Migration Script: Migrate @gmail.com to @flow.com
 *
 * Updates all existing documents in MongoDB Atlas:
 * 1. User collection: email
 * 2. Email collection: owner, sender, receiver
 *
 * Usage:
 *   Dry Run (preview changes without writing):
 *     node migrate-domain.js --dry-run
 *
 *   Live Run (apply changes to MongoDB):
 *     node migrate-domain.js
 *     or: npm run migrate
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Email = require('./models/Email');

const OLD_DOMAIN = '@gmail.com';
const NEW_DOMAIN = '@flow.com';

const isDryRun = process.argv.includes('--dry-run');

async function runMigration() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error('\n❌ ERROR: MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`🚀 MIGRATION: ${OLD_DOMAIN} -> ${NEW_DOMAIN}`);
  console.log(`MODE: ${isDryRun ? '🔍 DRY RUN (no changes will be saved)' : '⚡ LIVE RUN (writing changes to MongoDB)'}`);
  console.log('='.repeat(60));

  try {
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB.\n');

    // ==========================================
    // 1. MIGRATE USERS
    // ==========================================
    console.log('--- Checking User Collection ---');
    const userRegex = new RegExp(`${OLD_DOMAIN.replace('.', '\\.')}$`, 'i');
    const usersToUpdate = await User.find({ email: userRegex });

    console.log(`Found ${usersToUpdate.length} user(s) with ${OLD_DOMAIN}`);

    let usersUpdated = 0;
    let usersSkipped = 0;

    for (const user of usersToUpdate) {
      const oldEmail = user.email;
      const newEmail = oldEmail.replace(userRegex, NEW_DOMAIN).toLowerCase();

      // Check if target email already exists (prevent unique index violation)
      const existingConflict = await User.findOne({ email: newEmail });
      if (existingConflict && existingConflict._id.toString() !== user._id.toString()) {
        console.warn(`  ⚠️ Skipped user "${oldEmail}" -> "${newEmail}" already exists in database.`);
        usersSkipped++;
        continue;
      }

      if (isDryRun) {
        console.log(`  [DRY RUN] Would update user: ${oldEmail} -> ${newEmail}`);
        usersUpdated++;
      } else {
        user.email = newEmail;
        await user.save();
        console.log(`  ✓ Updated user: ${oldEmail} -> ${newEmail}`);
        usersUpdated++;
      }
    }

    // ==========================================
    // 2. MIGRATE EMAILS (owner, sender, receiver)
    // ==========================================
    console.log('\n--- Checking Email Collection ---');
    const emailRegex = new RegExp(`${OLD_DOMAIN.replace('.', '\\.')}$`, 'i');
    const emailsToUpdate = await Email.find({
      $or: [
        { owner: emailRegex },
        { sender: emailRegex },
        { receiver: emailRegex }
      ]
    });

    console.log(`Found ${emailsToUpdate.length} email record(s) matching ${OLD_DOMAIN}`);

    let emailsUpdated = 0;

    for (const emailDoc of emailsToUpdate) {
      let changed = false;
      const originalOwner = emailDoc.owner;
      const originalSender = emailDoc.sender;
      const originalReceiver = emailDoc.receiver;

      if (emailDoc.owner && emailRegex.test(emailDoc.owner)) {
        emailDoc.owner = emailDoc.owner.replace(emailRegex, NEW_DOMAIN).toLowerCase();
        changed = true;
      }
      if (emailDoc.sender && emailRegex.test(emailDoc.sender)) {
        emailDoc.sender = emailDoc.sender.replace(emailRegex, NEW_DOMAIN).toLowerCase();
        changed = true;
      }
      if (emailDoc.receiver && emailRegex.test(emailDoc.receiver)) {
        emailDoc.receiver = emailDoc.receiver.replace(emailRegex, NEW_DOMAIN).toLowerCase();
        changed = true;
      }

      if (changed) {
        if (isDryRun) {
          console.log(`  [DRY RUN] Email ${emailDoc._id}:`);
          if (originalOwner !== emailDoc.owner) console.log(`    owner:    ${originalOwner} -> ${emailDoc.owner}`);
          if (originalSender !== emailDoc.sender) console.log(`    sender:   ${originalSender} -> ${emailDoc.sender}`);
          if (originalReceiver !== emailDoc.receiver) console.log(`    receiver: ${originalReceiver} -> ${emailDoc.receiver}`);
          emailsUpdated++;
        } else {
          await emailDoc.save();
          console.log(`  ✓ Email ${emailDoc._id} updated (owner: ${emailDoc.owner}, sender: ${emailDoc.sender}, receiver: ${emailDoc.receiver})`);
          emailsUpdated++;
        }
      }
    }

    // ==========================================
    // 3. SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Users:  ${usersUpdated} ${isDryRun ? 'would be updated' : 'updated successfully'}${usersSkipped > 0 ? ` (${usersSkipped} skipped due to conflict)` : ''}`);
    console.log(`Emails: ${emailsUpdated} ${isDryRun ? 'would be updated' : 'updated successfully'}`);

    if (isDryRun) {
      console.log('\n💡 This was a dry run. To execute these updates for real, run:');
      console.log('   npm run migrate');
    } else {
      console.log('\n🎉 All database entries have been migrated to @flow.com!');
      console.log('💡 Note: If you have an active session in your browser localStorage, sign out and sign in again with @flow.com.');
    }
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    console.error('\n❌ Migration failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runMigration();
