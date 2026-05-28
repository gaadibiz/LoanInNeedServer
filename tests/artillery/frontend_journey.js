module.exports = {
  frontendUserJourney
};

async function frontendUserJourney(page, userContext, events) {
  // Generate random phone number for login
  const prefixes = ['7', '8', '9'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const phoneNumber = '+91' + prefix + Math.floor(100000000 + Math.random() * 900000000).toString();
  const otp = '261102'; // Bypass OTP

  // Start the actual UI Journey
  await page.goto('https://test.loaninneed.in/');

  // Optional: Take a screenshot of the homepage for debugging (saved locally)
  // await page.screenshot({ path: 'artillery_homepage.png' });

  // Example Interaction: We will wait for network to be idle to ensure Web Vitals (LCP) are recorded fully
  await page.waitForLoadState('networkidle');

  // Because the exact UI layout might vary, we wrap interactions in try/catch 
  // so the Artillery test doesn't crash entirely if a button is missing, 
  // but it still records the page load performance metrics.
  try {
    // Attempt to click a Login or Apply button
    const actionButton = page.locator('text=/(Login|Apply|Get Started)/i').first();
    if (await actionButton.isVisible()) {
      await actionButton.click();
      
      // Try to fill in the phone number
      const phoneInput = page.locator('input[type="tel"], input[name="phone"]').first();
      await phoneInput.waitFor({ state: 'visible', timeout: 5000 });
      await phoneInput.fill(phoneNumber);
      
      const submitBtn = page.locator('button[type="submit"], text=/Send OTP/i').first();
      await submitBtn.click();
      
      // Try to fill OTP
      const otpInput = page.locator('input[name="otp"], input[type="number"]').first();
      await otpInput.waitFor({ state: 'visible', timeout: 5000 });
      await otpInput.fill(otp);
      
      const verifyBtn = page.locator('button[type="submit"], text=/Verify/i').first();
      await verifyBtn.click();
      
      await page.waitForLoadState('networkidle');
    }
  } catch (error) {
    // If the UI is different from our generic assumptions, we log it,
    // but the test still successfully measures the core Homepage Web Vitals!
    events.emit('counter', 'ui_interaction_failed', 1);
  }
}
