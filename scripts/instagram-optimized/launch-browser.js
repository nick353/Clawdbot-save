const puppeteer = require('puppeteer');
const config = require('/root/clawd/config/puppeteer-vps-config.json');

async function launchOptimizedBrowser() {
  const browser = await puppeteer.launch({
    headless: config.launchOptions.headless,
    args: config.launchOptions.args,
    timeout: config.launchOptions.timeout,
    protocolTimeout: config.launchOptions.protocolTimeout,
  });

  const page = await browser.newPage();
  
  // タイムアウト設定
  page.setDefaultTimeout(config.defaultTimeout);
  page.setDefaultNavigationTimeout(config.navigationTimeout);
  
  // リクエストタイムアウト
  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.failure().errorText} (URL: ${request.url()})`);
  });

  return { browser, page };
}

async function navigateWithRetry(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`📍 Navigating to ${url}... (Attempt ${i + 1}/${maxRetries})`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      console.log(`✅ Navigation successful`);
      return true;
    } catch (error) {
      console.log(`⚠️ Navigation failed (Attempt ${i + 1}): ${error.message}`);
      if (i < maxRetries - 1) {
        console.log(`   🔄 Retrying in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  throw new Error(`Navigation failed after ${maxRetries} attempts`);
}

module.exports = { launchOptimizedBrowser, navigateWithRetry };
