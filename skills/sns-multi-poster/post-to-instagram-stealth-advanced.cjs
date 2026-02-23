#!/usr/bin/env node
/**
 * Instagram - Advanced Stealth Mode
 * より強力なbot検出回避：
 * - Chrome DevTools Protocol 制御
 * - リアルなネットワークタイミング
 * - 自然なマウスムーブメント
 * - Proxy IP偽装（VPS IP対策）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-stealth-advanced.cjs <image-path> [caption]');
  process.exit(1);
}

async function humanDelay(min = 1000, max = 3000) {
  const delay = Math.random() * (max - min) + min;
  await new Promise(r => setTimeout(r, delay));
}

async function main() {
  console.log('🚀 Instagram - Advanced Stealth Mode');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-preconnect',
      '--metrics-recording-only',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
    ],
  });

  let context;
  try {
    context = await browser.newContext({
      // More realistic user agent (various Chrome versions)
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { latitude: 37.7749, longitude: -122.4194 },  // San Francisco
      permissions: ['geolocation'],
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const page = await context.newPage();
    
    // Multiple stealth methods
    await page.addInitScript(() => {
      // Hide webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Hide chrome object
      if (typeof window.chrome === 'undefined') {
        window.chrome = {
          runtime: {},
          loadTimes: () => ({}),
          csi: () => ({}),
        };
      }

      // Hide phantom
      Object.defineProperty(window, 'phantom', {
        get: () => undefined,
      });

      // Hide plugin array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Fix languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Real permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        return originalQuery(parameters);
      };

      // Realistic console
      window.console._log = console.log;
      window.console.log = function(...args) {
        // Silently ignore some known bot-detection console.logs
        if (args[0] && args[0].includes?.('bot')) return;
      };

      // Fix toString
      Object.defineProperty(window.navigator, 'toString', {
        value: () => '[object Navigator]',
      });
    });

    page.setDefaultTimeout(120000);

    // Load cookies
    console.log('\n🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies`);
    }

    // Simulate realistic delays
    console.log('\n⏳ Simulating realistic user behavior...');
    await page.goto('about:blank');
    await humanDelay(800, 1500);

    // Home with realistic timing
    console.log('\n📍 Step 1: Loading Instagram Home');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });
    
    // Let page fully render
    await page.waitForTimeout(3000);
    console.log('✅ Home loaded');

    // Verify login
    console.log('\n📍 Step 2: Verifying login status');
    const isLoggedIn = await page.evaluate(() => {
      return document.querySelector('a[href="/"]') !== null ||
             document.querySelector('[aria-label="Home"]') !== null ||
             document.querySelector('svg[aria-label="Home"]') !== null;
    });
    
    if (!isLoggedIn) {
      throw new Error('Not logged in - cookies may be invalid');
    }
    console.log('✅ Logged in confirmed');
    await humanDelay(1500, 2500);

    // Navigate to /create
    console.log('\n📍 Step 3: Navigate to /create');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });
    
    const currentUrl = page.url();
    console.log(`  📌 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Redirected to login');
    }
    
    await page.waitForTimeout(3000);
    console.log('✅ /create loaded');

    // Handle modal
    console.log('\n📍 Step 4: Check for automated behavior modal');
    const dismissBtn = await page.locator('button:has-text("Dismiss")').first();
    if ((await page.locator('button:has-text("Dismiss")').count()) > 0) {
      console.log('  ⚠️ Modal detected, dismissing...');
      await humanDelay(500, 1000);
      await dismissBtn.click();
      console.log('  ✅ Dismissed');
      await humanDelay(2000, 3500);
    } else {
      console.log('  ✅ No modal');
    }

    // Upload file
    console.log('\n📍 Step 5: Upload file');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('  ✅ File uploaded');
    await humanDelay(2500, 3500);

    // Click Next
    console.log('\n📍 Step 6: Click Next');
    let nextBtn;
    for (let i = 0; i < 20; i++) {
      nextBtn = await page.locator('button:has-text("Next")').first();
      if (nextBtn) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (!nextBtn) {
      throw new Error('Next button not found');
    }
    
    await nextBtn.click();
    console.log('  ✅ Next clicked');
    await humanDelay(1500, 2500);

    // Caption
    if (captionArg.trim()) {
      console.log('\n📍 Step 7: Enter caption');
      const textarea = page.locator('textarea').first();
      await textarea.click();
      await humanDelay(300, 600);
      
      for (const char of captionArg) {
        await page.keyboard.type(char, { delay: 30 + Math.random() * 20 });
      }
      
      console.log('  ✅ Caption entered');
    }

    await humanDelay(1000, 2000);

    // Share
    console.log('\n📍 Step 8: Click Share');
    const shareBtn = page.locator('button:has-text("Share")').first();
    await shareBtn.click();
    console.log('  ✅ Share clicked');

    await humanDelay(3000, 5000);
    
    console.log('\n✨ Post completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
