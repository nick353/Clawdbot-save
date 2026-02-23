#!/usr/bin/env node
/**
 * Instagram v11-cookies
 * クッキーを使ってログイン状態を維持
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v11-cookies.cjs <image-path> [caption]');
  process.exit(1);
}

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      console.log(`✅ Loaded ${cookies.length} cookies`);
      return cookies;
    } catch (e) {
      console.warn('⚠️ Failed to parse cookies:', e.message);
      return [];
    }
  } else {
    console.warn('⚠️ No cookies file found at', cookiePath);
    return [];
  }
}

async function main() {
  console.log('🚀 Instagram v11-cookies - Using saved cookies');

  let browser;
  let context;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
      ],
    });

    // Create context
    context = await browser.newContext();

    // Load cookies
    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      console.log('✅ Cookies added to context');
    }

    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Step 1: Home (クッキーでログイン状態を維持)
    console.log('🌐 Step 1: Loading Instagram home with cookies...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 120000,
    });
    console.log('✅ Home loaded');

    // Step 2: /create へナビゲート
    console.log('🌐 Step 2: Navigating to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    console.log('✅ /create loaded');

    // ページがリダイレクトされたかチェック
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login')) {
      console.error('❌ Still on login page - cookies may be invalid');
      console.error('   Please refresh Instagram cookies');
      process.exit(1);
    }

    // Step 3: ページが十分に読み込まれるまで待機
    console.log('⏳ Step 3: Waiting for page to fully render (8s)...');
    await page.waitForTimeout(8000);

    // DOM情報を取得
    const domInfo = await page.evaluate(() => {
      return {
        hasFileInput: !!document.querySelector('input[type="file"]'),
        fileInputCount: document.querySelectorAll('input[type="file"]').length,
        hasNextButton: Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Next')),
        bodyTextSnippet: document.body.innerText.substring(0, 200),
      };
    });

    console.log('\n📊 DOM Info:');
    console.log(`  Has file input: ${domInfo.hasFileInput}`);
    console.log(`  File input count: ${domInfo.fileInputCount}`);
    console.log(`  Has Next button: ${domInfo.hasNextButton}`);
    console.log('');

    if (!domInfo.hasFileInput) {
      // スクリーンショット
      await page.screenshot({ path: '/tmp/instagram-v11-no-file-input.png', fullPage: true });
      throw new Error('No file input found - not on create page');
    }

    // Step 4: ファイルアップロード
    console.log('📁 Step 4: Uploading file...');
    await page.locator('input[type="file"]').setInputFiles(imagePathArg);
    console.log('✅ File uploaded');

    // Step 5: ページが反応するまで待機
    await page.waitForTimeout(3000);

    // Step 6: Next ボタン
    console.log('⏳ Step 5: Clicking Next...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    
    if (!await nextBtn.isVisible({ timeout: 10000 })) {
      throw new Error('Next button not visible after file upload');
    }
    
    await nextBtn.click();
    console.log('✅ Next clicked');

    // Step 7: Caption (optional)
    if (captionArg.trim()) {
      console.log('📝 Step 6: Entering caption...');
      await page.waitForTimeout(2000);
      
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 5000 })) {
        await textarea.fill(captionArg);
        console.log('✅ Caption entered');
      }
    }

    // Step 8: Share
    console.log('📤 Step 7: Clicking Share...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    
    if (!await shareBtn.isVisible({ timeout: 10000 })) {
      throw new Error('Share button not visible');
    }
    
    await shareBtn.click();
    console.log('✅ Share clicked');

    // Step 9: 完了確認
    console.log('⏳ Waiting for post completion...');
    await page.waitForTimeout(5000);
    console.log('🎉 Post completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
