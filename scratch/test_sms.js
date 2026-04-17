require('dotenv').config();
const { sendOtp } = require('../utils/smsOtpService');

async function testSMS() {
    // Try sending without the '+91' or '+'
    const phoneNumber1 = '9875403824';
    console.log(`Testing SMS OTP to ${phoneNumber1}...`);
    try {
        const result1 = await sendOtp(phoneNumber1);
        console.log('Success!', result1);
    } catch (err) {
        console.error('Error sending SMS to without +91:', err);
    }
}

testSMS();
