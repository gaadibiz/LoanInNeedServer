/**
 * los_live_test.js  — LOS Live Integration Connectivity Check (v2)
 * Run: node los_live_test.js
 * Output is written to los_live_result.txt for clean reading.
 * v2 changes:
 *   - Fixed AddressLine1 comma (caused SQL error on LOS)
 *   - Updated KYC payload to Documents array format
 *   - Token lookup: LOS returns 'Token' (capital T)
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const LOS_AUTH_URL = 'http://59.95.101.93:7021/api/auth/login';
const LOS_SAVE_URL = 'http://59.95.101.93:7021/api/NewApplicationAPI/SaveNewApplication';
const LOS_KYC_URL  = 'http://59.95.101.93:7021/api/ChatBotKYCProof/SaveChatBotKYCProof';
const LOS_USER     = 'indradeep';
const LOS_PASS     = 'admin123';
const TIMEOUT      = 30000;

const lines = [];
const log = (msg) => { console.log(msg); lines.push(msg); };

const save = () => {
    fs.writeFileSync(path.join(__dirname, 'los_live_result.txt'), lines.join('\n'), 'utf8');
};

async function main() {
    log('='.repeat(60));
    log('  LOS LIVE INTEGRATION TEST — ' + new Date().toISOString());
    log('='.repeat(60));
    log('');

    // -------------------------------------------------------------------
    // STEP 1 — Token Auth
    // -------------------------------------------------------------------
    log('--- STEP 1: Token Auth ---');
    log('  URL: ' + LOS_AUTH_URL);
    log('  Body: { UserName: "' + LOS_USER + '", Password: "***" }');
    let token = null;
    try {
        const t0 = Date.now();
        const r = await axios.post(LOS_AUTH_URL,
            { UserName: LOS_USER, Password: LOS_PASS },
            { headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT }
        );
        const ms = Date.now() - t0;
        log('  HTTP Status : ' + r.status + ' (' + ms + 'ms)');
        log('  Response    : ' + JSON.stringify(r.data));

        token = r.data.token
            || r.data.Token
            || r.data.access_token
            || r.data.AccessToken
            || r.data.jwtToken
            || null;

        if (token) {
            log('  TOKEN       : FOUND (length=' + token.length + ', first 40 chars: ' + token.substring(0, 40) + '...)');
            log('  STEP 1      : PASS');
        } else {
            log('  TOKEN       : NOT FOUND in response body');
            log('  STEP 1      : FAIL — no token field in response');
        }
    } catch (err) {
        log('  ERROR       : ' + err.message);
        if (err.response) {
            log('  ERR HTTP    : ' + err.response.status);
            log('  ERR BODY    : ' + JSON.stringify(err.response.data));
        }
        log('  STEP 1      : FAIL');
    }

    log('');

    if (!token) {
        log('ABORTING: Cannot proceed without a valid token.');
        save();
        process.exit(1);
    }

    // -------------------------------------------------------------------
    // STEP 2 — SaveNewApplication
    // -------------------------------------------------------------------
    log('--- STEP 2: SaveNewApplication ---');
    log('  URL: ' + LOS_SAVE_URL);
    const paydayDate = new Date();
    paydayDate.setDate(paydayDate.getDate() + 30);

    const appPayload = {
        ProductID:          13,
        LoanAmountRequired: 50000,
        PayDayDate:         paydayDate.toISOString(),

        PurposeOfLoanID:    49,     // Medical Emergency
        EmploymentTypeID:   342,    // Salaried
        SalutationID:       273,    // Mr.

        FirstName:          'Rahul',
        MiddleName:         'Kumar',
        LastName:            'Sharma',
        DateOfBirth:        new Date('1990-01-15').toISOString(),

        MobileNo:           '9876543210',
        Email:              'rahul.test@loaninneed.com',
        PanSSN:             'ABCDE1234F',
        AdharDrivingNo:     '123456789012',

        Address: {
            AddressTypeID: 335,     // Current Address
            ResidentType:  319,     // Owner (Self or Family)
            AddressLine1:  '123 Test Street Apt 4B',   // No commas - LOS SQL parser fails on commas
            StateID:       1109,    // Maharashtra
            PinZipCode:    '400001',
            PhoneNo:       '9876543210'
        }
    };

    log('  Payload (summary): FirstName=' + appPayload.FirstName + ', Loan=' + appPayload.LoanAmountRequired + ', PanSSN=' + appPayload.PanSSN);
    let appData = null;
    let step2Pass = false;
    try {
        const t0 = Date.now();
        const r2 = await axios.post(LOS_SAVE_URL, appPayload, {
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            timeout: TIMEOUT
        });
        const ms = Date.now() - t0;
        log('  HTTP Status : ' + r2.status + ' (' + ms + 'ms)');
        log('  Response    : ' + JSON.stringify(r2.data));
        appData = r2.data;

        // Detect success or failure in response body
        const isSuccess = r2.data?.IsSuccess === true
            || r2.data?.isSuccess === true
            || r2.data?.StatusCode === 200
            || r2.data?.status === 'SUCCESS'
            || r2.data?.Status === 'Success';

        const appId = r2.data?.ApplicationId || r2.data?.applicationId || r2.data?.ApplicationID || null;
        log('  ApplicationId from LOS: ' + (appId || 'NOT RETURNED'));
        log('  IsSuccess flag: ' + isSuccess);
        step2Pass = isSuccess;
        log('  STEP 2      : ' + (step2Pass ? 'PASS' : 'PARTIAL — HTTP 200 but check response body above'));
    } catch (err) {
        log('  ERROR       : ' + err.message);
        if (err.response) {
            log('  ERR HTTP    : ' + err.response.status);
            log('  ERR BODY    : ' + JSON.stringify(err.response.data));
        }
        log('  STEP 2      : FAIL');
    }

    log('');

    // -------------------------------------------------------------------
    // STEP 3 — SaveChatBotKYCProof
    // -------------------------------------------------------------------
    log('--- STEP 3: SaveChatBotKYCProof ---');
    log('  URL: ' + LOS_KYC_URL);

    const appId = appData?.ApplicationId || appData?.applicationId || appData?.ApplicationID || 0;
    // LOS SaveChatBotKYCProof expects a Documents array
    const kycPayload = {
        ApplicationId: appId,
        CreatedBy:     1,
        Documents: [
            {
                ProofType:      'PAN',
                ProofNumber:    'ABCDE1234F',
                DocumentBase64: ''   // empty for connectivity test
            }
        ]
    };
    log('  Using ApplicationId: ' + appId);
    log('  Payload: ' + JSON.stringify(kycPayload));
    let step3Pass = false;
    try {
        const t0 = Date.now();
        const r3 = await axios.post(LOS_KYC_URL, kycPayload, {
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            timeout: TIMEOUT
        });
        const ms = Date.now() - t0;
        log('  HTTP Status : ' + r3.status + ' (' + ms + 'ms)');
        log('  Response    : ' + JSON.stringify(r3.data));

        const kycSuccess = r3.data?.IsSuccess === true
            || r3.data?.isSuccess === true
            || r3.data?.StatusCode === 200
            || r3.data?.status === 'SUCCESS'
            || r3.data?.Status === 'Success';

        step3Pass = kycSuccess;
        log('  STEP 3      : ' + (step3Pass ? 'PASS' : 'PARTIAL — HTTP 200 but check response body above'));
    } catch (err) {
        log('  ERROR       : ' + err.message);
        if (err.response) {
            log('  ERR HTTP    : ' + err.response.status);
            log('  ERR BODY    : ' + JSON.stringify(err.response.data));
        }
        log('  STEP 3      : FAIL');
    }

    log('');

    // -------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------
    log('='.repeat(60));
    log('  TEST SUMMARY');
    log('='.repeat(60));
    log('  Step 1 — Token Auth          : ' + (token ? 'PASS' : 'FAIL'));
    log('  Step 2 — SaveNewApplication  : ' + (step2Pass ? 'PASS' : 'FAIL/PARTIAL'));
    log('  Step 3 — SaveChatBotKYCProof : ' + (step3Pass ? 'PASS' : 'FAIL/PARTIAL'));
    log('');
    log('  NOTE: "PARTIAL" means HTTP 200 was received but the LOS');
    log('  response body indicates a business-level issue (e.g.,');
    log('  missing required fields, duplicate entry, etc.).');
    log('='.repeat(60));

    save();
    log('');
    log('Full output saved to: los_live_result.txt');
}

main().catch(err => {
    log('FATAL: ' + err.message);
    save();
    process.exit(1);
});
