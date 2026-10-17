/**
 * Safe Local MongoDB Backup Utility for Shree Ganesh Kirana Store ERP
 * Dumps all collections, documents, and index metadata to a local backup directory.
 */
const path = require('path');
module.paths.push(path.join(__dirname, '../server/node_modules'));
const mongoose = require('mongoose');
const fs = require('fs');

const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/inventory_erp';
const BACKUP_DIR = path.join(__dirname, '../database_backups', `backup_${Date.now()}`);

async function backupLocalDatabase() {
  console.log('===============================================================');
  console.log('📦 CREATING LOCAL MONGODB BACKUP');
  console.log(`Connecting to: ${LOCAL_URI}`);
  console.log(`Destination: ${BACKUP_DIR}`);
  console.log('===============================================================\n');

  try {
    await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const collections = await db.listCollections().toArray();
    const manifest = {
      timestamp: new Date().toISOString(),
      database: db.databaseName,
      collections: {},
    };

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = db.collection(colName);
      const docs = await col.find({}).toArray();
      const indexes = await col.indexes();

      const dumpPath = path.join(BACKUP_DIR, `${colName}.json`);
      fs.writeFileSync(dumpPath, JSON.stringify(docs, null, 2), 'utf-8');

      const indexPath = path.join(BACKUP_DIR, `${colName}.indexes.json`);
      fs.writeFileSync(indexPath, JSON.stringify(indexes, null, 2), 'utf-8');

      manifest.collections[colName] = {
        count: docs.length,
        dataFile: `${colName}.json`,
        indexFile: `${colName}.indexes.json`,
      };

      console.log(`  ✅ Backed up collection: ${colName.padEnd(16)} [${docs.length} documents]`);
    }

    fs.writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    console.log('\n===============================================================');
    console.log(`🎉 LOCAL DATABASE BACKUP COMPLETE`);
    console.log(`Files stored in: ${BACKUP_DIR}`);
    console.log('===============================================================\n');
    return manifest;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  backupLocalDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { backupLocalDatabase };
