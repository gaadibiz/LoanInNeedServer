const { S3Client } = require('@aws-sdk/client-s3');
const logger = require('./logger');

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT, // e.g., https://sfo3.digitaloceanspaces.com
  region: process.env.DO_SPACES_REGION || 'sfo3', // e.g., sfo3
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

module.exports = s3Client;
