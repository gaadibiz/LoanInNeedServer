module.exports = {
  generateAuthPayload,
  generateLoanPayload,
  logErrors
};

const crypto = require('crypto');

function generateAuthPayload(userContext, events, done) {
  const prefixes = ['7', '8', '9'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = '+91' + prefix + Math.floor(100000000 + Math.random() * 900000000).toString();
  
  userContext.vars.phoneNumber = num;
  userContext.vars.otp = '261102';
  
  return done();
}

function generateLoanPayload(userContext, events, done) {
  userContext.vars.firstName = 'Test' + crypto.randomBytes(3).toString('hex');
  userContext.vars.lastName = 'User' + crypto.randomBytes(3).toString('hex');
  userContext.vars.pan = 'ABCDE' + Math.floor(1000 + Math.random() * 9000) + 'F';
  userContext.vars.aadhaar = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  userContext.vars.email = 'test.' + crypto.randomBytes(4).toString('hex') + '@loaninneed.com';
  userContext.vars.loanAmount = Math.floor(5000 + Math.random() * 95000); 
  
  return done();
}

// Intercepts failures and logs exact reasons to the dashboard
function logErrors(requestParams, response, userContext, events, done) {
  if (response.statusCode >= 400) {
    let errorDetail = 'Unknown Error';
    try {
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      errorDetail = body.message || body.error || `HTTP ${response.statusCode}`;
    } catch (e) {
      errorDetail = `HTTP ${response.statusCode}`;
    }
    events.emit('counter', `backend_error: ${errorDetail}`, 1);
  }
  return done();
}
