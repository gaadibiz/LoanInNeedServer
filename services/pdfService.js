/**
 * PDF Generation Service for Loan Applications
 * Generates a professional, branded PDF with all applicant details
 * and a formatted Loan Application Number for LOS team referencing.
 */
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * Formats the application number from raw DB id + createdAt date
 * Format: LN + 10 digits
 * Example: LN0000000034
 */
function formatApplicationNumber(applicationId, createdAt) {
    const paddedId = String(applicationId).padStart(10, '0');
    return `LN${paddedId}`;
}

/**
 * Generates a loan application PDF as a Buffer
 * @param {Object} application - The LoanApplication record with included relations
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateApplicationPdf(application) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
                info: {
                    Title: `Loan Application - ${formatApplicationNumber(application.id, application.createdAt)}`,
                    Author: 'LoanInNeed',
                    Subject: 'Loan Application Form',
                }
            });

            const buffers = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const user = application.user || {};
            const employment = user.employment || {};
            const address = user.address || {};
            const pan = user.panVerification || {};
            const aadhaar = user.aadhaarVerification || {};
            const appNumber = formatApplicationNumber(application.id, application.createdAt);
            const appDate = new Date(application.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric'
            });

            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

            // ─── HEADER ───
            // Red banner bar
            doc.rect(0, 0, doc.page.width, 8).fill('#EF4444');

            // Company name
            doc.moveDown(0.5);
            doc.fontSize(26).font('Helvetica-Bold').fillColor('#EF4444')
                .text('LoanInNeed', { align: 'center' });
            doc.fontSize(10).font('Helvetica').fillColor('#6B7280')
                .text('Instant Financial Support You Can Rely On', { align: 'center' });

            doc.moveDown(0.5);

            // Divider
            const dividerY = doc.y;
            doc.moveTo(50, dividerY).lineTo(doc.page.width - 50, dividerY)
                .strokeColor('#E5E7EB').lineWidth(1).stroke();

            doc.moveDown(0.8);

            // ─── APPLICATION NUMBER BOX ───
            const boxY = doc.y;
            const boxHeight = 65;
            doc.roundedRect(50, boxY, pageWidth, boxHeight, 8)
                .fill('#FEF2F2');

            doc.fontSize(11).font('Helvetica').fillColor('#991B1B')
                .text('LOAN APPLICATION NUMBER', 70, boxY + 12, { width: pageWidth - 40 });
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#EF4444')
                .text(appNumber, 70, boxY + 30, { width: pageWidth - 40 });

            doc.y = boxY + boxHeight + 15;

            // Date & Status row
            doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
                .text(`Date of Application: ${appDate}`, 50, doc.y);
            doc.fontSize(9).font('Helvetica-Bold')
                .fillColor(application.status === 'APPROVED' ? '#059669' : application.status === 'REJECTED' ? '#DC2626' : '#D97706')
                .text(`Status: ${application.status}`, 50, doc.y, { align: 'right', width: pageWidth });

            doc.moveDown(1.5);

            // ─── HELPER: Section Header ───
            function sectionHeader(title) {
                const y = doc.y;
                doc.rect(50, y, 4, 18).fill('#EF4444');
                doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827')
                    .text(title, 62, y + 1);
                doc.moveDown(0.8);
            }

            // ─── HELPER: Detail Row ───
            function detailRow(label, value) {
                const y = doc.y;
                doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
                    .text(label, 60, y, { width: 180, continued: false });
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937')
                    .text(value || '—', 240, y, { width: pageWidth - 200 });
                doc.y = y + 18;
            }

            // ─── APPLICANT DETAILS ───
            sectionHeader('Applicant Details');

            const fullName = user.name || '—';
            const dob = user.dob
                ? new Date(user.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                : '—';
            const gender = user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1).toLowerCase() : '—';

            detailRow('Full Name', fullName);
            detailRow('Date of Birth', dob);
            detailRow('Gender', gender);
            detailRow('Mobile Number', user.phone || '—');
            detailRow('Email', user.email || '—');
            detailRow('PAN Number', pan.panNumber || '—');
            detailRow('Aadhaar Number', aadhaar.aadhaarNumber
                ? aadhaar.aadhaarNumber.replace(/(\d{4})/g, '$1 ').trim()
                : '—');

            doc.moveDown(0.8);

            // ─── EMPLOYMENT DETAILS ───
            sectionHeader('Employment Details');

            detailRow('Employment Type', employment.employmentType
                ? employment.employmentType.charAt(0) + employment.employmentType.slice(1).toLowerCase().replace(/_/g, ' ')
                : '—');
            detailRow('Employer / Company', employment.employerName || '—');
            detailRow('Company Address', employment.companyAddress || '—');
            detailRow('Monthly Income', employment.monthlyIncome
                ? `₹ ${Number(employment.monthlyIncome).toLocaleString('en-IN')}`
                : '—');
            detailRow('Job Stability', employment.stability
                ? employment.stability.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '—');

            doc.moveDown(0.8);

            // ─── ADDRESS DETAILS ───
            sectionHeader('Address Details');

            detailRow('Current Address', address.currentAddress || '—');
            detailRow('Address Type', address.currentAddressType
                ? address.currentAddressType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '—');
            detailRow('Permanent Address', address.permanentAddress || '—');
            detailRow('City', address.city || '—');
            detailRow('State', address.state || '—');
            detailRow('PIN Code', address.postalCode || '—');

            doc.moveDown(0.8);

            // ─── LOAN DETAILS ───
            sectionHeader('Loan Details');

            detailRow('Loan Amount Requested', application.loanAmount
                ? `₹ ${Number(application.loanAmount).toLocaleString('en-IN')}`
                : '—');
            detailRow('Loan Type / Purpose', application.loanType
                ? application.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                : '—');
            detailRow('Application Status', application.status);

            doc.moveDown(2);

            // ─── FOOTER SECTION ───
            const footerY = doc.page.height - 110;

            // Divider
            doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
                .strokeColor('#E5E7EB').lineWidth(0.5).stroke();

            doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
                .text(
                    'This is a system-generated document. For any queries, contact support@loaninneed.in or call +91 98309 18171.',
                    50, footerY + 10,
                    { align: 'center', width: pageWidth }
                );
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#9CA3AF')
                .text(
                    `Reference No: ${appNumber} | Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`,
                    50, footerY + 25,
                    { align: 'center', width: pageWidth }
                );
            doc.fontSize(7).font('Helvetica').fillColor('#D1D5DB')
                .text(
                    'LoanInNeed is a digital lending platform. This document is for reference purposes only and does not constitute a loan sanction letter.',
                    50, footerY + 45,
                    { align: 'center', width: pageWidth }
                );

            // Bottom red bar
            doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill('#EF4444');

            doc.end();

        } catch (err) {
            logger.error('[PDF] Error generating PDF: %s', err.message);
            reject(err);
        }
    });
}

module.exports = { generateApplicationPdf, formatApplicationNumber };
