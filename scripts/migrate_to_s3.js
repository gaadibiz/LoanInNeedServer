const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../utils/s3Client');
const fs = require('fs').promises;

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET;

const mimeTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

async function getFilesRecursively(dir) {
  let results = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(await getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

async function runMigration() {
  console.log(`Starting migration from ${UPLOAD_DIR} to DO Spaces bucket: ${DO_SPACES_BUCKET}`);
  
  try {
    const files = await getFilesRecursively(UPLOAD_DIR);
    console.log(`Found ${files.length} files to process.`);

    for (const filePath of files) {
      // Create a relative path for the S3 object key (e.g. 'uploads/Documents/AADHAAR/.../file.jpg')
      const relativePath = path.relative(path.join(__dirname, '..'), filePath);
      // Ensure forward slashes for S3 object keys
      const s3Key = relativePath.split(path.sep).join('/');
      
      console.log(`Uploading ${s3Key}...`);
      
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      const command = new PutObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ACL: 'public-read',
        ContentType: contentType,
      });

      await s3Client.send(command);
      console.log(`✅ Uploaded: ${s3Key}`);
    }

    console.log('🎉 Migration completed successfully!');
    console.log('NOTE: Local files have NOT been deleted for safety. Once you confirm DO Spaces works, you can delete them.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the script
runMigration();
