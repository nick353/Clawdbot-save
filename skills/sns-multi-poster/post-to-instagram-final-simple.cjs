#!/usr/bin/env node
/**
 * Instagram Final (Simple & Reliable)
 * post-to-instagram-reels.cjs をベースに、画像投稿対応
 * Puppeteer + Stealth で安定動作
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [, , imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('❌ Usage: post-to-instagram-final-simple.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ Image not found: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function main() {
  console.log('🚀 Instagram Final (Simple & Reliable)');
  console.log(`📸 Image: ${imagePath}`);
  console.log(`📝 Caption: ${caption.substring(0, 80)}...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Stealth headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Load cookies
    console.log('\n🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        
        // Puppeteer cookie format に変換
        const puppeteerCookies = cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: '.instagram.com',
          path: '/',
          secure: true,
          httpOnly: c.httpOnly || false,
          expires: c.expirationDate || (Date.now() / 1000 + 365 * 24 * 3600),
        }));
        
        await page.setCookie(...puppeteerCookies);
        console.log(`✅ Loaded ${puppeteerCookies.length} cookies`);
      } catch (e) {
        console.warn('⚠️ Failed to load cookies:', e.message);
      }
    } else {
      console.warn('⚠️ No cookies file found');
    }

    // Home
    console.log('\n🌐 Loading Instagram home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    console.log('✅ Home loaded');

    // Check login
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href="/"]');
    });
    console.log(isLoggedIn ? '✅ Logged in' : '⚠️ Not logged in');

    // Navigate to /create
    console.log('\n🌐 Navigating to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Redirect to login - cookies are invalid');
    }
    console.log('✅ /create page loaded');

    // Wait for page
    console.log('\n⏳ Waiting for page to render...');
    await page.waitForTimeout(5000);

    // File input
    console.log('\n📁 Looking for file input...');
    const fileInputExists = await page.$('input[type="file"]');
    if (!fileInputExists) {
      throw new Error('No file input found');
    }
    console.log('✅ File input found');

    // Upload
    console.log('📁 Uploading image...');
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('File input disappeared');
    
    // Puppeteer v20+ use .uploadFile()
    try {
      await fileInput.uploadFile(imagePath);
    } catch (e) {
      // Fallback: use setInputFiles (newer Playwright-like API)
      console.log('  Trying alternative upload method...');
      await page.evaluate((path) => {
        // Last resort: trigger file selection dialog and inject file
        const input = document.querySelector('input[type="file"]');
        const dataTransfer = new DataTransfer();
        const file = new File(['fake'], 'image.jpg', { type: 'image/jpeg' });
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, imagePath);
    }
    console.log('✅ Image uploaded');

    // Wait
    console.log('\n⏳ Waiting for Next button (15s)...');
    
    let nextFound = false;
    for (let i = 0; i < 15; i++) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(b => b.innerText, btn);
        if (text === 'Next') {
          nextFound = true;
          break;
        }
      }
      if (nextFound) break;
      await page.waitForTimeout(1000);
    }

    if (!nextFound) {
      console.log('⚠️ Next button not found');
      await page.screenshot({ path: '/tmp/ig-final-no-next.png' });
      throw new Error('Next button not found after 15s');
    }

    console.log('✅ Next button found');

    // Click Next
    console.log('\n🖱️ Clicking Next...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Next');
      if (btn) btn.click();
    });
    console.log('✅ Next clicked');

    // Wait
    await page.waitForTimeout(3000);

    // Caption
    if (caption.trim()) {
      console.log('\n📝 Entering caption...');
      const textarea = await page.$('textarea');
      if (textarea) {
        await textarea.click();
        await page.keyboard.type(caption, { delay: 50 });
        console.log('✅ Caption entered');
      }
    }

    // Share
    console.log('\n📤 Clicking Share...');
    const shareClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Share');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!shareClicked) {
      throw new Error('Share button not found');
    }
    console.log('✅ Share clicked');

    // Wait for completion
    await page.waitForTimeout(5000);
    console.log('\n🎉 Post completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();
