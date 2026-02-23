#!/usr/bin/env node
/**
 * Instagram v13-fixed-create
 * v7ベース + より堅牢なCreate button検出
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-v13-fixed-create.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v13-fixed-create');
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
    });

    const page = await context.newPage();
    
    // Stealth 対応
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);

    // Cookie読み込み
    console.log('🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies`);
    }

    // Instagram Home
    console.log('🌐 Loading Instagram home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log('✅ Home loaded');

    // 直接 /create URL にアクセス（最も確実）
    console.log('🌐 Navigating directly to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log('✅ /create page loaded');

    // URL確認
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login')) {
      console.error('❌ Still on login page - cookies are invalid');
      console.error('   Please refresh cookies in Instagram manually');
      process.exit(1);
    }

    // ページが十分に読み込まれるまで待機
    console.log('⏳ Waiting for page to fully render (5s)...');
    await page.waitForTimeout(5000);

    // ファイル入力要素を確認
    console.log('📁 Checking for file input...');
    const fileInputCount = await page.locator('input[type="file"]').count();
    console.log(`   Found ${fileInputCount} file input(s)`);

    if (fileInputCount === 0) {
      // デバッグ: ボタンと要素を一覧表示
      const buttons = await page.locator('button').count();
      console.log(`   Also found ${buttons} buttons`);
      
      const allInputs = await page.locator('input').count();
      console.log(`   All inputs: ${allInputs}`);
      
      // スクリーンショット
      await page.screenshot({ path: '/tmp/instagram-v13-no-file-input.png' });
      throw new Error('No file input found on /create page');
    }

    // ファイルアップロード
    console.log('📁 Uploading image...');
    await page.locator('input[type="file"]').first().setInputFiles(imagePathArg);
    console.log('✅ Image uploaded');

    // ページの更新を待つ
    console.log('⏳ Waiting for page update after upload (10s)...');
    await page.waitForTimeout(10000);

    // Next ボタンを待つ
    console.log('🔍 Waiting for Next button...');
    
    let nextFound = false;
    for (let i = 0; i < 10; i++) {
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text && text.toLowerCase().includes('next')) {
          nextFound = true;
          break;
        }
      }
      
      if (nextFound) {
        console.log(`✅ Next button found after ${i} iterations`);
        break;
      }
      
      await page.waitForTimeout(1000);
      if (i === 9) {
        console.error('❌ Next button not found after 10s');
        await page.screenshot({ path: '/tmp/instagram-v13-no-next.png' });
        throw new Error('Next button not found');
      }
    }

    // Nextをクリック
    console.log('🖱️ Clicking Next...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.click();
    console.log('✅ Next clicked');

    // ページ更新を待つ
    await page.waitForTimeout(3000);

    // Caption (オプション)
    if (captionArg.trim()) {
      console.log('📝 Entering caption...');
      const textareas = await page.locator('textarea').all();
      if (textareas.length > 0) {
        await textareas[0].fill(captionArg);
        console.log('✅ Caption entered');
      }
    }

    // Share
    console.log('📤 Clicking Share...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    await shareBtn.click();
    console.log('✅ Share clicked');

    // 完了待機
    await page.waitForTimeout(5000);
    console.log('🎉 Post completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
