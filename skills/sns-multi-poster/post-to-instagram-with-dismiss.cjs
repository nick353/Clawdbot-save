#!/usr/bin/env node
/**
 * Instagram Post - With Dismiss Modal
 * "We suspect automated behavior" モーダルを処理
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-with-dismiss.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

async function humanDelay(min = 1000, max = 3000) {
  const delay = Math.random() * (max - min) + min;
  await new Promise(r => setTimeout(r, delay));
}

async function shortDelay(min = 300, max = 800) {
  const delay = Math.random() * (max - min) + min;
  await new Promise(r => setTimeout(r, delay));
}

async function main() {
  console.log('🚀 Instagram Post - With Dismiss Modal Handler');
  console.log(`📸 Image: ${imagePathArg}`);
  console.log(`📝 Caption: ${captionArg.substring(0, 80)}`);
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  let context;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();
    
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      if (typeof window.chrome === 'undefined') {
        window.chrome = { runtime: {} };
      }
    });

    page.setDefaultTimeout(120000);

    // Load cookies
    console.log('\n🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies`);
    }

    // Home
    console.log('\n📍 Step 1: Loading Home');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log('✅ Home loaded');
    await humanDelay(1500, 2500);

    // /create
    console.log('\n📍 Step 2: Navigate to /create');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log(`✅ /create loaded (URL: ${page.url()})`);
    await humanDelay(2000, 3000);

    // Check for modal and dismiss
    console.log('\n📍 Step 3: Checking for automated behavior modal');
    
    const dismissBtn = await page.locator('button:has-text("Dismiss")').first();
    const dismissCount = await page.locator('button:has-text("Dismiss")').count();
    
    if (dismissCount > 0) {
      console.log(`  ⚠️ Found ${dismissCount} Dismiss button(s)`);
      console.log('  🖱️ Clicking Dismiss...');
      await shortDelay(500, 1000);
      await dismissBtn.click();
      console.log('  ✅ Dismiss clicked');
      await humanDelay(2000, 3500);
    } else {
      console.log('  ✅ No modal found (good!)');
    }

    // Wait for file input
    console.log('\n📍 Step 4: Wait for file input to appear');
    let fileInputFound = false;
    
    for (let i = 0; i < 15; i++) {
      const count = await page.locator('input[type="file"]').count();
      if (count > 0) {
        fileInputFound = true;
        console.log(`  ✅ File input found (${i}s)`);
        break;
      }
      console.log(`  ⏳ Checking... (${i}s)`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!fileInputFound) {
      throw new Error('File input not found after 15s');
    }

    // Upload image
    console.log('\n📍 Step 5: Upload image');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('  ✅ File uploaded');
    await humanDelay(2000, 3500);

    // Find and click Next
    console.log('\n📍 Step 6: Click Next');
    let nextFound = false;
    
    for (let i = 0; i < 15; i++) {
      const count = await page.locator('button:has-text("Next")').count();
      if (count > 0) {
        nextFound = true;
        break;
      }
      console.log(`  ⏳ Waiting for Next button... (${i}s)`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!nextFound) {
      await page.screenshot({ path: '/tmp/instagram-after-upload.png', fullPage: true });
      throw new Error('Next button not found');
    }

    console.log('  ✅ Next button found');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.click();
    console.log('  ✅ Next clicked');
    await humanDelay(1500, 2500);

    // Add caption if provided
    if (captionArg.trim()) {
      console.log('\n📍 Step 7: Enter caption');
      const textareas = await page.locator('textarea').all();
      
      if (textareas.length > 0) {
        await textareas[0].click();
        await shortDelay(300, 600);
        
        for (const char of captionArg) {
          await page.keyboard.type(char, { delay: 30 + Math.random() * 20 });
        }
        
        console.log('  ✅ Caption entered');
      }
    }

    await humanDelay(1000, 2000);

    // Share
    console.log('\n📍 Step 8: Click Share');
    const shareBtn = page.locator('button:has-text("Share")').first();
    await shareBtn.click();
    console.log('  ✅ Share clicked');

    // Wait for completion
    console.log('\n📍 Step 9: Wait for post completion');
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
