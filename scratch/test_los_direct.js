const axios = require('axios');

const LOS_AUTH_URL = 'http://59.95.101.93:7021/api/auth/login';
const LOS_SAVE_URL = 'http://59.95.101.93:7021/api/NewApplicationAPI/SaveNewApplication';
const LOS_USERNAME = 'indradeep';
const LOS_PASSWORD = 'admin123';

const payload = {
  "OrganizationID": 1,
  "LoanTypeID": 16,
  "ProductSchemeName": "PayDay Loan Scheme",
  "FirstName": "Jyoti",
  "MiddleName": "Test",
  "LastName": "Jiwtode",
  "DateOfBirth": "1997-01-20T10:38:43.468Z",
  "MobileNo": "97897 89789",
  "Email": "test@gmail.com",
  "PanSSN": "XXX-XX-5534",
  "AdharDrivingNo": "6456456546546",
  "LoanCategoryCode": "RLT",
  "ProductCategoryCode": "UNSEC",
  "ProductID": 13,
  "ProductName": "PayDay Loan",
  "LoanAmountRequired": 5000,
  "Tenure": 10,
  "InterestRate": 6,
  "PayCheckAmt": 50000,
  "PayDayDate": "2026-01-13T07:20:42.464Z",

  "Address": {
    "AddressLine1": "IT PARK",
    "CityName": "Nagpur",
    "StateID": 1059,
    "PinZipCode": "345678",
    "PhoneNo": "99879 78678"
  },

  "KYC_Individual": {
    "FirstName": "Jyoti",
    "MiddleName": "Test",
    "LastName": "Jiwtode",
    "MobileNo": "97897 89789",
    "Email": "test@gmail.com",
    "PanSSN": "XXX-XX-5534",
    "AdharDrivingNo": "6456456546546"
  },

  "IsJointApplication": true,
  "IsCoBorrower": true
};

async function testLOS() {
  try {
    console.log("1. Authenticating with LOS...");
    const authRes = await axios.post(LOS_AUTH_URL, {
        UserName: LOS_USERNAME,
        Password: LOS_PASSWORD,
        username: LOS_USERNAME,
        password: LOS_PASSWORD
    }, { headers: { 'Content-Type': 'application/json' } });
    
    // Extract token
    const token = authRes.data.Token || authRes.data.token || authRes.data.AccessToken;
    if (!token) {
        throw new Error("No token returned! " + JSON.stringify(authRes.data));
    }
    console.log(" -> Token obtained:", token.slice(0, 15) + "...");

    console.log("\n2. Sending Loan Payload to LOS_SAVE_URL...");
    console.log("Payload:", JSON.stringify(payload, null, 2));

    const saveRes = await axios.post(LOS_SAVE_URL, payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    });

    console.log(" -> Success! Response:");
    console.log(JSON.stringify(saveRes.data, null, 2));

  } catch (err) {
    console.error("\n❌ FAILED:");
    if (err.response) {
      console.error(`HTTP Status: ${err.response.status}`);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

testLOS();
