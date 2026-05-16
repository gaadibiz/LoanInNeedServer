const axios = require('axios');
const fs = require('fs');

const FRONTEND_BASE = "https://seahorse-app-92emo.ondigitalocean.app";
const BACKEND_BASE = "https://lionfish-app-mg3te.ondigitalocean.app";

const testSuite = [
  // --- FRONTEND ROUTES ---
  { category: "Frontend", name: "Home Page Routing", url: `${FRONTEND_BASE}/`, method: "GET", expectStatus: [200, 304] },
  { category: "Frontend", name: "Apply Now Form", url: `${FRONTEND_BASE}/apply-now`, method: "GET", expectStatus: [200, 304] },
  { category: "Frontend", name: "Track Loan Tracker", url: `${FRONTEND_BASE}/track-loan`, method: "GET", expectStatus: [200, 304] },
  { category: "Frontend", name: "Static Content (About Us)", url: `${FRONTEND_BASE}/about-us`, method: "GET", expectStatus: [200, 304] },

  // --- BACKEND HEALTH & CORE ---
  { 
    category: "Backend System", 
    name: "Primary Health Check", 
    url: `${BACKEND_BASE}/`, 
    method: "GET", 
    expectStatus: [200],
    validate: (data) => data.status === 'healthy' || data.message
  },

  // --- BACKEND AUTH (Boundary Testing) ---
  { 
    category: "Auth Security", 
    name: "OTP Request (Malformed Data)", 
    url: `${BACKEND_BASE}/api/auth/phone/request-otp`, 
    method: "POST", 
    data: { phone: "invalid" },
    expectStatus: [400, 422, 500] // Validation should catch it
  },

  // --- BACKEND SECURITY (JWT Guards) ---
  { 
    category: "JWT Protection", 
    name: "Secure Route: User Profile", 
    url: `${BACKEND_BASE}/api/users/profile/complete`, 
    method: "GET", 
    expectStatus: [401, 403] 
  },
  { 
    category: "JWT Protection", 
    name: "Secure Route: KYC Details", 
    url: `${BACKEND_BASE}/api/kyc/`, 
    method: "GET", 
    expectStatus: [401, 403, 404] 
  },
  { 
    category: "JWT Protection", 
    name: "Secure Route: Document Status", 
    url: `${BACKEND_BASE}/api/document/status`, 
    method: "GET", 
    expectStatus: [401, 403] 
  },
  { 
    category: "JWT Protection", 
    name: "Secure Route: Partner Dashboard", 
    url: `${BACKEND_BASE}/api/partners/dashboard`, 
    method: "GET", 
    expectStatus: [401, 403] 
  },

  // --- API VALIDATION BOUNDARIES ---
  { 
    category: "Validation", 
    name: "Selfie Upload (Missing Form Data)", 
    url: `${BACKEND_BASE}/api/selfie/upload`, 
    method: "POST", 
    expectStatus: [400, 401, 403]
  },
  { 
    category: "Validation", 
    name: "Loan Application (Missing Payload)", 
    url: `${BACKEND_BASE}/api/loans/apply`, 
    method: "POST", 
    expectStatus: [400, 401, 403]
  }
];

async function runAdvancedTests() {
  console.log("\n=======================================================");
  console.log("   🚀 LOANINNEED PRODUCTION E2E DIAGNOSTIC SUITE 🚀    ");
  console.log("=======================================================\n");
  
  let totalScore = 0;
  const maxScore = testSuite.length * 10;
  const results = [];

  for (const test of testSuite) {
    let status = "PENDING";
    let latency = 0;
    let endpointScore = 0;
    let message = "";
    
    process.stdout.write(`⏳ [${test.category}] ${test.name.padEnd(35)} `);
    
    const startTime = Date.now();
    try {
      const response = await axios({
        method: test.method,
        url: test.url,
        data: test.data,
        timeout: 10000,
        headers: { "Content-Type": "application/json" }
      });
      
      latency = Date.now() - startTime;
      
      if (test.expectStatus.includes(response.status)) {
        let valid = true;
        if (test.validate && typeof test.validate === 'function') {
           valid = test.validate(response.data);
        }
        
        if (valid) {
          status = "✅ PASS";
          endpointScore = 10;
          message = `Status ${response.status} (Valid Payload)`;
        } else {
          status = "⚠️ WARN";
          endpointScore = 5;
          message = `Status ${response.status} (Invalid Payload)`;
        }
      } else {
        status = "❌ FAIL";
        message = `Expected ${test.expectStatus.join('/')}, Got ${response.status}`;
      }
      
    } catch (err) {
      latency = Date.now() - startTime;
      
      if (err.response) {
        if (test.expectStatus.includes(err.response.status)) {
          status = "✅ PASS";
          endpointScore = 10;
          message = `Status ${err.response.status} (Expected Error)`;
        } else {
          status = "❌ FAIL";
          message = `Expected ${test.expectStatus.join('/')}, Got ${err.response.status}`;
        }
      } else if (err.code === 'ECONNABORTED') {
        status = "❌ FAIL";
        message = "Timeout (> 10s)";
      } else {
        status = "❌ FAIL";
        message = err.message;
      }
    }
    
    // Penalize for high latency (only if it didn't completely fail)
    if (endpointScore > 0) {
       if (latency > 2000) endpointScore -= 5;
       else if (latency > 1000) endpointScore -= 2;
    }
    
    totalScore += endpointScore;
    results.push({ ...test, status, latency, score: endpointScore, message });
    
    console.log(`| ${status} | ${latency}ms | ${message}`);
  }

  const finalPercentage = ((totalScore / maxScore) * 100).toFixed(1);
  let healthGrade = finalPercentage >= 95 ? "A+ (Excellent)" : 
                    finalPercentage >= 85 ? "B (Good)" : 
                    finalPercentage >= 70 ? "C (Fair)" : "F (Critical Issues)";

  console.log("\n=======================================================");
  console.log(`🏆 FINAL SYSTEM SCORE: ${totalScore} / ${maxScore} (${finalPercentage}%)`);
  console.log(`📊 HEALTH GRADE: ${healthGrade}`);
  console.log("=======================================================\n");

  // Output JSON for the markdown report generator
  fs.writeFileSync('test_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScore,
    maxScore,
    percentage: finalPercentage,
    healthGrade,
    results
  }, null, 2));
}

runAdvancedTests();
