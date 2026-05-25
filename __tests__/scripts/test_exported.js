const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'exported_loans.json');
if (!fs.existsSync(filePath)) {
    console.error('exported_loans.json not found!');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
console.log('Total records:', data.length);

const shivaniRecords = data.filter(record => 
    (record.name && record.name.toLowerCase().includes('shivani')) || 
    (record.mobileNo && record.mobileNo.includes('8800222344')) || 
    record.id === 'LIN181' ||
    record.id === '181'
);

console.log('Shivani Singh records found:', shivaniRecords.length);
if (shivaniRecords.length > 0) {
    console.log(JSON.stringify(shivaniRecords, null, 2));
} else {
    // Print first 5 records as sample
    console.log('First 3 records:', JSON.stringify(data.slice(0, 3), null, 2));
}
