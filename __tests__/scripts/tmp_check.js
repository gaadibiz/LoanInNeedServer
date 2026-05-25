const val = 'paromita$432';
const b64 = Buffer.from(val).toString('base64');
const decoded = Buffer.from(b64, 'base64').toString('utf8');
console.log('Original :', val);
console.log('Base64   :', b64);
console.log('Decoded  :', decoded);
console.log('Match    :', val === decoded);
