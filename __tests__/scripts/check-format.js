const fs = require('fs');
const path = require('path');
const { encodeFileToBase64 } = require('./Backend/utils/base64Encoder');

const getBase64Safe = (doc) => {
    const defaultImage = 'https://via.placeholder.com/150';
    if (!doc) return `default.jpg,${defaultImage}`;

    const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
    
    try {
        if (!doc.filePath) return `${docName},${defaultImage}`;
        const absolutePath = path.join(__dirname, 'Backend', doc.filePath);
        if (fs.existsSync(absolutePath)) {
            const b64 = encodeFileToBase64(absolutePath, false);
            return `${docName},${b64}`;
        }
        return `${docName},${defaultImage}`;
    } catch (err) {
        return `${docName},${defaultImage}`;
    }
};

const doc1 = { docType: 'ADDRESS', fileName: 'test1.txt', filePath: 'uploads/Documents/AADHAAR/1/test_file.txt' };
const doc2 = { docType: 'ADDRESS', fileName: 'test2.txt', filePath: 'uploads/Documents/AADHAAR/1/test_file.txt' };

const docs = [doc1, doc2];
const addressDocumentStrArr = docs.map(d => getBase64Safe(d));
const addressDocument = addressDocumentStrArr.map(docStr => ['Base64', docStr]);

console.log(JSON.stringify({ addressDocument }, null, 2));
