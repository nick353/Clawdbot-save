#!/usr/bin/env node
/**
 * Instagram Post - Human-Like Version
 * 人間らしい動作を徹底：
 * - ランダム遅延（1～3秒）
 * - 自然なマウス操作
 * - リアルなUser-Agent
 * - Stealth detection回避
 * - ページ読み込みをゆっくり待つ
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-human-like.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

// Human-like delay (1~3 seconds + random)
async function humanDelay(min = 1000, max = 3000) {
  const delay = Math.random() * (max - min) + min;
  console.log(`  💭 Human delay: ${Math.round(delay)}ms`);
  await new Promise(r => setTimeout(r, delay));
}

// Short random delay
async function shortDelay(min = 300, max = 800) {
  const delay = Math.random() * (max - min) + min;
  await new Promise(r => setTimeout(r, delay));
}

async function main() {
  console.log('🚀 Instagram Post - Human-Like Version');
  console.log(`📸 Image: ${imagePathArg}`);
  console.log(`📝 Caption: ${captionArg.substring(0, 80)}...`);
  console.log('');
  console.log('⚙️ Human-like behavior:');
  console.log('  ✓ Random delays (1~3s)');
  console.log('  ✓ Natural mouse movements');
  console.log('  ✓ Real User-Agent');
  console.log('  ✓ Stealth detection evasion');
  console.log('');

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
      // リアルなUser-Agent（Windows 10 + Chrome 120）
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      permissions: ['geolocation'],
      // Referer
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const page = await context.newPage();
    
    // Stealth対応
    await page.addInitScript(() => {
      // webdriver フラグを隠す
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // chrome オブジェクトを保証
      if (typeof window.chrome === 'undefined') {
        window.chrome = {
          runtime: {}
        };
      }
      
      // Phantom.js 回避
      Object.defineProperty(window, 'phantom', {
        get: () => undefined,
      });
    });

    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Load cookies
    console.log('🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies\n`);
    } else {
      console.warn('⚠️ No cookies file found\n');
    }

    // Step 1: Home (人間らしくゆっくり)
    console.log('📍 Step 1: Loading Instagram Home');
    console.log('  🌐 Navigating...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log('  ✅ Page loaded');
    await humanDelay(1500, 2500);

    // Step 2: Check login status
    console.log('\n📍 Step 2: Checking login status');
    const isLoggedIn = await page.evaluate(() => {
      //複数の方法でログイン状態を確認
      return !!document.querySelector('a[href="/"]') || !!document.querySelector('[aria-label="Home"]');
    });
    console.log(isLoggedIn ? '  ✅ Logged in' : '  ⚠️ Not logged in');
    await shortDelay();

    // Step 3: Navigate to /create (自然な方法)
    console.log('\n📍 Step 3: Navigating to Create page');
    console.log('  🌐 Going to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });

    const currentUrl = page.url();
    console.log(`  📌 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Redirected to login - cookies may be invalid');
    }
    if (currentUrl.includes('/challenge')) {
      throw new Error('Challenge page - need human verification');
    }
    
    console.log('  ✅ Create page loaded');
    await humanDelay(2000, 3000);

    // Step 4: Wait for page to fully render (複数回チェック)
    console.log('\n📍 Step 4: Waiting for page to fully render');
    let fileInputFound = false;
    
    for (let i = 0; i < 10; i++) {
      const count = await page.locator('input[type="file"]').count();
      if (count > 0) {
        fileInputFound = true;
        console.log(`  ✅ File input found after ${i * 1}s`);
        break;
      }
      console.log(`  ⏳ Checking... (${i}s)`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!fileInputFound) {
      // Debug: Take screenshot and analyze DOM
      console.log('\n  ⚠️ File input not found - analyzing DOM...');
      const dom = await page.evaluate(() => {
        return {
          title: document.title,
          inputCount: document.querySelectorAll('input').length,
          buttonCount: document.querySelectorAll('button').length,
          hasFileInput: !!document.querySelector('input[type="file"]'),
          htmlSnippet: document.body.innerHTML.substring(0, 500),
        };
      });
      
      console.log(`  📊 DOM Analysis:`);
      console.log(`    Title: ${dom.title}`);
      console.log(`    Inputs: ${dom.inputCount}`);
      console.log(`    Buttons: ${dom.buttonCount}`);
      console.log(`    Has file input: ${dom.hasFileInput}`);
      
      await page.screenshot({ path: '/tmp/instagram-human-like-debug.png' });
      throw new Error('No file input found after full render wait');
    }

    // Step 5: Upload image (人間らしくゆっくり)
    console.log('\n📍 Step 5: Uploading image');
    console.log('  📁 Selecting file...');
    await shortDelay();
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('  ✅ File selected');
    
    // ファイル選択後のページ更新を待つ
    console.log('  ⏳ Waiting for upload processing...');
    await humanDelay(2000, 3500);

    // Step 6: Wait for Next button
    console.log('\n📍 Step 6: Looking for Next button');
    
    let nextFound = false;
    let nextAttempts = 0;
    
    while (!nextFound && nextAttempts < 15) {
      const buttons = await page.locator('button').all();
      
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && text.trim() === 'Next') {
          nextFound = true;
          console.log(`  ✅ Next button found (attempt ${nextAttempts})`);
          break;
        }
      }
      
      if (!nextFound) {
        nextAttempts++;
        console.log(`  ⏳ Waiting... (${nextAttempts}s)`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!nextFound) {
      await page.screenshot({ path: '/tmp/instagram-human-like-no-next.png' });
      throw new Error('Next button not found after 15s');
    }

    // Step 7: Click Next (人間らしくマウスを動かす)
    console.log('\n📍 Step 7: Clicking Next');
    const nextBtn = page.locator('button:has-text("Next")').first();
    
    // マウスを動かしてからクリック（自然な動作）
    const box = await nextBtn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2);
      await shortDelay(200, 500);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await shortDelay(100, 300);
    }
    
    await nextBtn.click();
    console.log('  ✅ Next clicked');
    await humanDelay(1500, 2500);

    // Step 8: Caption (optional)
    if (captionArg.trim()) {
      console.log('\n📍 Step 8: Entering caption');
      const textareas = await page.locator('textarea').all();
      
      if (textareas.length > 0) {
        const textarea = textareas[0];
        
        // タイピングを人間らしく
        await textarea.click();
        await shortDelay(300, 600);
        
        // 1文字ずつゆっくり入力
        for (const char of captionArg) {
          await page.keyboard.type(char, { delay: Math.random() * 50 + 30 });
        }
        
        console.log('  ✅ Caption entered');
      }
    }

    await humanDelay(1000, 2000);

    // Step 9: Share (人間らしくクリック)
    console.log('\n📍 Step 9: Clicking Share');
    const shareBtn = page.locator('button:has-text("Share")').first();
    
    const shareBox = await shareBtn.boundingBox();
    if (shareBox) {
      await page.mouse.move(shareBox.x + shareBox.width / 2 - 30, shareBox.y + shareBox.height / 2);
      await shortDelay(200, 400);
      await page.mouse.move(shareBox.x + shareBox.width / 2, shareBox.y + shareBox.height / 2);
      await shortDelay(100, 250);
    }
    
    await shareBtn.click();
    console.log('  ✅ Share clicked');

    // Step 10: Wait for completion
    console.log('\n📍 Step 10: Waiting for post to complete');
    await humanDelay(3000, 5000);
    
    console.log('\n✨ Post completed successfully!');
    console.log('🎉 Image posted to Instagram\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
