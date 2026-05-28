const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const path = require('path');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../utils/s3Client');
const { getMemoized } = require('../utils/memoizedCache');

const DUMMY_PDF_BASE64 = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgb3V0cHV0Pj4Kc3RyZWFtCgplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZSAvUGFnZS9QYXJlbnQgMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8Pj4vQ29udGVudHMgMiAwIFI+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlIC9QYWdlcy9LaWRzWzQgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZy9QYWdlcyAxIDAgUj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxODcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMDAwIGYgCjAwMDAwMDAwNzggMDAwMDAgbiAKMDAwMDAwMDAyNDAgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCA1IDAgUj4+CnN0YXJ0eHJlZgoyODgKJSVFT0Y=';

// Heavy function to fetch from S3
async function fetchFromS3(s3Key) {
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
    
    return buffer.toString('base64');
}

async function getBase64Safe(doc) {
    if (!doc) return null;
    const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
    
    try {
        if (!doc.filePath && !doc.fileUrl) {
            return [DUMMY_PDF_BASE64, docName];
        }
        
        if (process.env.STORAGE_PROVIDER === 's3') {
            let s3Key = null;
            if (doc.fileUrl && doc.fileUrl.includes(process.env.DO_SPACES_BUCKET)) {
                try {
                    const urlObj = new URL(doc.fileUrl);
                    s3Key = decodeURIComponent(urlObj.pathname.substring(1));
                } catch (e) {}
            } else if (doc.filePath) {
                s3Key = doc.filePath.replace(/\\/g, '/');
            }

            if (s3Key) {
                try {
                    // Integrate Thundering Herd Protection (Memoized Cache)
                    // If 100 applications share the same template file, it only downloads once
                    const b64 = await getMemoized(s3Key, 60000, () => fetchFromS3(s3Key));
                    return [b64, docName];
                } catch (err) {
                    logger.warn(`[LOAN EXPORT] Error fetching from S3 Key: ${s3Key} | ${err.message}`);
                }
            }
        }
        return [DUMMY_PDF_BASE64, docName];
    } catch (err) {
        logger.error(`[LOAN EXPORT] Critical error encoding doc: ${err.message}`);
        return [DUMMY_PDF_BASE64, docName];
    }
}

async function formatApplicationData(app) {
    try {
        const u = app.user;
        const emp = u?.employment || {};
        const addr = u?.address || {};
        const loc = u?.locations?.[0] || {};
        const aadh = u?.aadhaarVerification || {};
        const pan = u?.panVerification || {};

        const getDocsByType = async (type) => {
            if (!u?.documents) return null;
            const docs = u.documents.filter(d => d.docType === type);
            if (docs.length === 0) return null;
            if (['ADDRESS', 'PAY_SLIP', 'BANK_STATEMENT'].includes(type)) {
                const results = await Promise.all(docs.map(d => getBase64Safe(d)));
                const filtered = results.filter(Boolean);
                return filtered.length > 0 ? filtered : null;
            }
            return await getBase64Safe(docs[0]);
        };

        const [aadhaarFront, addressDocument, profilePicture, panCard, salarySlips, bankStatements] = await Promise.all([
            getDocsByType('AADHAAR'),
            getDocsByType('ADDRESS'),
            getDocsByType('PHOTO'),
            getDocsByType('PAN'),
            getDocsByType('PAY_SLIP'),
            getDocsByType('BANK_STATEMENT')
        ]);
        
        return {
            id: u?.customUserId || app.id.toString(),
            name: u?.name || null,
            mobileNo: u?.phone || null,
            loanAmount: app.loanAmount || null,
            loanPurpose: app.loanType || null,
            addressDocument,
            aadhaarNo: aadh.aadhaarNumber ? aadh.aadhaarNumber.replace(/_DUP_\d+$/, '').trim() || null : null,
            panNo: pan.panNumber || null,
            profilePicture,
            aadhaarFront,
            panCard,
            salarySlips,
            bankStatements,
            employmentProofDocument: (bankStatements && bankStatements.length > 0) ? bankStatements[0] : null,
            createdAt: app.createdAt,
            status: app.status,
            applicationNumber: app.id,
        };
    } catch (appFormatError) {
        logger.error(`[LOAN EXPORT] Fallback triggered. App ID ${app.id}: ${appFormatError.message}`);
        return { applicationNumber: app.id, status: 'DATA_ERROR', error: true };
    }
}

module.exports = {
    formatApplicationData
};
