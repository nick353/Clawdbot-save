#!/usr/bin/env node
/**
 * Instagram ログイン状態デバッグ
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      const fixedCookies = cookies.map(c => ({
        ...c,
        sameSite: (c.sameSite === 'unspecified' || !c.sameSite) ? 'Lax' : 
                  (c.sameSite === 'no_restriction') ? 'None' :
                  (c.sameSite === 'lax') ? 'Lax' :
                  (c.sameSite === 'strict') ? 'Strict' :
                  (c.sameSite === 'none') ? 'None' : c.sameSite
      }));
      console.log(`✅ Loaded ${fixedCookies.length} cookies`);
      return fixedCookies;
    } catch (e) {
      console.warn('⚠️ Failed to parse cookies');
      return [];
    }
  }
  return [];
}

async function main() {
  console.log('🔍 Instagram login status check...');

  let browser;
  let context;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
      ],
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    console.log('🌐 Loading Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // スクリーンショット取得
    const screenshotPath = path.join(__dirname, 'debug-instagram-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // ログイン状態チェック
    if (currentUrl.includes('/accounts/login')) {
      console.log('❌ Not logged in - redirected to login page');
    } else {
      console.log('✅ Logged in successfully');
      
      // /create に移動
      console.log('🌐 Loading /create...');
      await page.goto('https://www.instagram.com/create/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      const createUrl = page.url();
      console.log(`📍 Create URL: ${createUrl}`);
      
      const createScreenshotPath = path.join(__dirname, 'debug-instagram-create.png');
      await page.screenshot({ path: createScreenshotPath, fullPage: true });
      console.log(`📸 Create screenshot saved: ${createScreenshotPath}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
