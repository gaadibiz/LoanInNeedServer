require('dotenv').config();
const axios = require('axios');

async function testRawAPI() {
    const phoneNumber = '9875403824';
    const SMS_API_URL = process.env.SMS_API_URL || 'https://omc.speqtrainnov.in/api/json/sendsms/';
    const SMS_API_KEY = process.env.SMS_API_KEY;
    const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
    const SMS_ENTITY_ID = process.env.SMS_ENTITY_ID;
    const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID;

    const requestBody = {
        listsms: [
            {
                sms: "Dear Customer, your OTP for LOANINNEED is 123456. It is valid for 10 minutes. Do not share this OTP with anyone. -SASHIM",
                mobiles: phoneNumber,
                senderid: SMS_SENDER_ID,
                entityid: SMS_ENTITY_ID,
                tempid: SMS_TEMPLATE_ID
            }
        ]
    };

    console.log("Request Body:", JSON.stringify(requestBody, null, 2));
    console.log("API Key:", SMS_API_KEY);

    try {
        const response = await axios.post(SMS_API_URL, requestBody, {
            headers: {
                'key': SMS_API_KEY,
                'content-type': 'application/json'
            },
            timeout: 10000
        });

        console.log('Raw Response Data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error('Error status:', err.response.status);
            console.error('Error response:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error:', err.message);
        }
    }
}

testRawAPI();
