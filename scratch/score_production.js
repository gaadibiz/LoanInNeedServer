const axios = require('axios');

const endpoints = [
  {
    name: "Frontend Application Home",
    url: "https://seahorse-app-92emo.ondigitalocean.app/",
    method: "GET"
  },
  {
    name: "Frontend Apply Page",
    url: "https://seahorse-app-92emo.ondigitalocean.app/apply-now",
    method: "GET"
  },
  {
    name: "Backend Root/Healthcheck",
    url: "https://lionfish-app-mg3te.ondigitalocean.app/",
    method: "GET"
  },
  {
    name: "Backend Auth Service (Request OTP)",
    url: "https://lionfish-app-mg3te.ondigitalocean.app/api/auth/phone/request-otp",
    method: "POST",
    data: { phone: "9999999999" }
  }
];

async function runTests() {
  console.log("==========================================");
  console.log("   PRODUCTION API TESTING & SCORING       ");
  console.log("==========================================");
  
  let score = 0;
  let totalScore = endpoints.length * 25; // 25 points per endpoint
  let results = [];

  for (const ep of endpoints) {
    console.log(`\nTesting: ${ep.name}...`);
    let startTime = Date.now();
    try {
      const response = await axios({
        method: ep.method,
        url: ep.url,
        data: ep.data,
        timeout: 15000,
        headers: { "Content-Type": "application/json" }
      });
      
      let latency = Date.now() - startTime;
      console.log(`✅ Status: ${response.status} (Latency: ${latency}ms)`);
      
      let endpointScore = 25;
      if (latency > 2000) {
        endpointScore -= 5;
        console.log(`⚠️ Warning: High latency (-5 pts)`);
      }
      
      score += endpointScore;
      results.push({ name: ep.name, status: "PASS", score: endpointScore, latency });
      
    } catch (err) {
      let latency = Date.now() - startTime;
      if (err.response) {
        // Some endpoints like POST request-otp might return 400 if phone format is bad, but it still means the API is UP
        console.log(`✅ Status: ${err.response.status} (API is reachable) (Latency: ${latency}ms)`);
        
        let endpointScore = 20; // Reached API but got an error status
        if (latency > 2000) endpointScore -= 5;
        
        score += endpointScore;
        results.push({ name: ep.name, status: "PASS (Handled Error)", score: endpointScore, latency });
      } else {
        console.log(`❌ FAILED: ${err.message} (Latency: ${latency}ms)`);
        results.push({ name: ep.name, status: "FAIL", score: 0, latency });
      }
    }
  }

  console.log("\n==========================================");
  console.log(`🏆 FINAL SYSTEM SCORE: ${score} / ${totalScore}`);
  const percentage = (score / totalScore) * 100;
  console.log(`📊 Health Rating: ${percentage >= 90 ? "Excellent" : percentage >= 70 ? "Good" : "Needs Attention"}`);
  console.log("==========================================\n");
}

runTests();
