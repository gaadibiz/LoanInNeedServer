const { PrismaClient } = require('./Backend/node_modules/@prisma/client');
const path = require('path');
const fs = require('fs');
const { encodeFileToBase64 } = require('./Backend/utils/base64Encoder');

const prisma = new PrismaClient();

async function test() {
    const docs = await prisma.userDocument.findMany({ take: 5 });
    console.log('Found ' + docs.length + ' documents');
    
    for (const doc of docs) {
        console.log('\nTesting Document ID:', doc.id, doc.docType, doc.filePath);
        
        const getBase64Safe = (doc) => {
            const defaultImage = 'https://via.placeholder.com/150';
            if (!doc) return `default.jpg,${defaultImage}`;

            const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
            
            try {
                if (!doc.filePath) return `${docName},${defaultImage}`;
                
                const absolutePath = path.join(__dirname, 'Backend', doc.filePath);
                
                console.log('Looking for file at:', absolutePath);
                if (fs.existsSync(absolutePath)) {
                    const b64 = encodeFileToBase64(absolutePath, false);
                    return { success: true, name: docName, b64Length: b64.length, preview: b64.substring(0, 50) + '...' };
                } else {
                    return { success: false, error: 'File does not exist' };
                }
            } catch (err) {
                return { success: false, error: err.message };
            }
        };
        
        console.log(getBase64Safe(doc));
    }
}
test().catch(console.error).finally(() => prisma.$disconnect());
