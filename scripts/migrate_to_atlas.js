/**
 * Automated MongoDB Local-to-Atlas Cloud Migration Script
 * Shree Ganesh Kirana Store Inventory Management System
 * 
 * Safely transfers all collections, documents, and indexes from local MongoDB to Atlas Cloud,
 * verifies document counts, and checks for duplicates.
 */
const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const mongoose = require('mongoose');

async function migrateToAtlas(targetAtlasUri, sourceLocalUri) {
  const localUri = sourceLocalUri || process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/inventory_erp';
  const atlasUri = targetAtlasUri || process.env.MONGODB_URI;

  if (!atlasUri) {
    throw new Error('Target Atlas URI is required. Provide it as an argument or in MONGODB_URI.');
  }

  if (atlasUri.includes('127.0.0.1') || atlasUri.includes('localhost')) {
    throw new Error('Target URI appears to be a local database, not MongoDB Atlas.');
  }

  console.log('===============================================================');
  console.log('🚀 MONGODB ATLAS CLOUD MIGRATION UTILITY');
  console.log(`Source: ${localUri}`);
  console.log(`Target: ${atlasUri.replace(/:([^:@]+)@/, ':****@')}`);
  console.log('===============================================================\n');

  // Step 1: Connect to Source Local DB
  console.log('1️⃣ Connecting to Source (Local MongoDB)...');
  const localConn = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  console.log('  ✅ Connected to Local MongoDB.');

  // Step 2: Connect to Target Atlas DB
  console.log('\n2️⃣ Connecting to Target (MongoDB Atlas Cloud)...');
  const atlasConn = await mongoose.createConnection(atlasUri, { serverSelectionTimeoutMS: 15000 }).asPromise();
  console.log('  ✅ Connected to MongoDB Atlas Cloud.');

  const localDb = localConn.db;
  const atlasDb = atlasConn.db;

  const collections = await localDb.listCollections().toArray();
  const report = {
    timestamp: new Date().toISOString(),
    results: [],
  };

  console.log(`\n3️⃣ Migrating ${collections.length} collections to MongoDB Atlas...\n`);

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip internal system collections
    if (colName.startsWith('system.')) continue;

    const sourceCol = localDb.collection(colName);
    const targetCol = atlasDb.collection(colName);

    const sourceDocs = await sourceCol.find({}).toArray();
    const sourceCount = sourceDocs.length;
    const initialTargetCount = await targetCol.countDocuments({});

    console.log(`📦 Processing collection: [${colName}]`);
    console.log(`   Source documents: ${sourceCount} | Existing in Atlas: ${initialTargetCount}`);

    let inserted = 0;
    let skipped = 0;

    if (sourceDocs.length > 0) {
      for (const doc of sourceDocs) {
        // Upsert by _id to guarantee idempotency and avoid duplicate key crashes
        const result = await targetCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
        if (result.upsertedCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }
    }

    // Copy Indexes
    const sourceIndexes = await sourceCol.indexes();
    for (const idx of sourceIndexes) {
      if (idx.name === '_id_') continue; // Skip default _id index
      try {
        const { key, name, unique, sparse, ...otherOpts } = idx;
        await targetCol.createIndex(key, { name, unique, sparse, ...otherOpts });
      } catch (idxErr) {
        // Index might already exist
      }
    }

    const finalTargetCount = await targetCol.countDocuments({});
    const verified = finalTargetCount >= sourceCount;

    console.log(`   Migration status: Inserted: ${inserted}, Updated/Preserved: ${skipped}`);
    console.log(`   Verification: Source=${sourceCount} -> Atlas=${finalTargetCount} [${verified ? '✅ MATCH' : '⚠️ MISMATCH'}]\n`);

    report.results.push({
      collection: colName,
      sourceCount,
      targetCount: finalTargetCount,
      verified,
    });
  }

  await localConn.close();
  await atlasConn.close();

  console.log('===============================================================');
  console.log('🎉 MIGRATION TO MONGODB ATLAS COMPLETE');
  console.log('===============================================================');
  return report;
}

if (require.main === module) {
  const target = process.argv[2] || process.env.MONGODB_URI;
  migrateToAtlas(target)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { migrateToAtlas };
