require('dotenv').config({ path: '.env' });
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('./utils/s3Client');

async function testS3() {
    const s3Key = 'uploads/Documents/BANK_STATEMENT/846/1779473590604_EMT-PayslipJan-23.pdf';

    try {
        console.log(`Fetching ${s3Key} from bucket ${process.env.DO_SPACES_BUCKET}...`);
        const command = new GetObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: s3Key
        });
        const s3Response = await s3Client.send(command);
        
        const buffer = await new Promise((resolve, reject) => {
            const chunks = [];
            s3Response.Body.on('data', (chunk) => chunks.push(chunk));
            s3Response.Body.on('end', () => resolve(Buffer.concat(chunks)));
            s3Response.Body.on('error', reject);
        });
        
        const b64 = buffer.toString('base64');
        console.log(`Success! Fetched file. Base64 length: ${b64.length}`);
    } catch (err) {
        console.error(`Error fetching: ${err.name} - ${err.message}`);
    }
}

testS3();
