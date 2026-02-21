const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Starting Twitter login test with Stealth Plugin...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('📱 Navigating to Twitter login page...');
  await page.goto('https://twitter.com/login', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  console.log('📸 Taking screenshot...');
  await page.screenshot({ path: '/root/clawd/twitter-login-stealth.png', fullPage: true });
  
  const title = await page.title();
  console.log('✅ Page title:', title);
  
  // Check for error messages
  const bodyText = await page.evaluate(() => document.body.innerText);
  
  if (bodyText.includes('Something went wrong')) {
    console.log('❌ Twitter detected bot behavior');
  } else if (bodyText.includes('Sign in') || bodyText.includes('Log in')) {
    console.log('✅ Login page loaded successfully!');
    console.log('📝 Page contains login form');
  } else {
    console.log('⚠️ Unexpected page content:');
    console.log(bodyText.substring(0, 500));
  }
  
  await browser.close();
  console.log('🏁 Test complete!');
})();
