require('dotenv').config();
const documentService = require('./services/documentService');
const fs = require('fs');

async function testUpload() {
  try {
    console.log('Testing S3 Upload with STORAGE_PROVIDER:', process.env.STORAGE_PROVIDER);
    
    // Create a dummy file
    const dummyPath = './test_dummy.txt';
    fs.writeFileSync(dummyPath, 'Hello Digital Ocean Spaces!');
    
    const dummyFile = {
      originalname: 'test_dummy.txt',
      mimetype: 'text/plain',
      size: 27,
      buffer: fs.readFileSync(dummyPath) // simulating memoryStorage
    };
    
    // Hardcoded test user ID
    const userId = 9999;
    
    // We pass a dummy transaction object to bypass Prisma since we only want to test the S3 part
    // Wait, documentService calls tx.userDocument.create. So we should test against the real DB or mock it.
    // Let's just run it, if there's no DB connection, it'll fail at the DB part, but the upload part happens first!
    
    // Let's just see if S3 upload works by calling a simplified version or mocking prisma
    console.log('Attempting uploadDocument...');
    
    // Mock prisma tx
    const mockTx = {
      userDocument: {
        create: async (data) => {
          console.log('Mock DB Insert:', data);
          return { id: 1, ...data.data };
        }
      }
    };
    
    const result = await documentService.uploadDocument(userId, dummyFile, 'AADHAAR', mockTx);
    console.log('Upload Result:', result);
    
    // Cleanup dummy file
    fs.unlinkSync(dummyPath);
    console.log('✅ Test complete.');
  } catch (err) {
    console.error('❌ Upload Failed:', err);
  }
}

testUpload();
