#!/usr/bin/env node
/**
 * Instagram v7-stealth
 * Playwright + chromium-with-stealth + 60秒タイムアウト
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Stealth plugin を playwright へ適用（実験的）
StealthPlugin().onPageCreate(async (page) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
});

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-v7-stealth.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v7-stealth (Playwright)');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-web-resources',
    ],
  });

  let context;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    
    // タイムアウト 60秒
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Stealth設定
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    console.log('🔐 Cookie読み込み...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ ${cookies.length} cookies loaded`);
    } else {
      console.warn('⚠️ Cookie not found, proceeding without auth');
    }

    console.log('🌐 Instagram にアクセス (60秒タイムアウト)...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    console.log('✅ Page loaded');

    // 実際にログイン状態か確認
    const isLoggedIn = await page.locator('a[href="/"]').first().isVisible().catch(() => false);
    if (!isLoggedIn) {
      console.warn('⚠️ Not logged in, attempting to create post anyway...');
    }

    // Create button を探す
    console.log('🔍 Create button を探索...');
    const createBtn = page.locator('[aria-label="Create"]').first();
    
    try {
      await createBtn.click({ timeout: 5000 });
      console.log('✅ Create button clicked');
    } catch (e) {
      console.error('❌ Create button not found:', e.message);
      
      // Fallback: XPath で探す
      console.log('🔄 Fallback: XPath で再探索...');
      const fallbackBtn = page.locator('xpath=//a[contains(@href, "/create/")]').first();
      await fallbackBtn.click({ timeout: 5000 });
      console.log('✅ Create button clicked (fallback)');
    }

    // ファイル選択ダイアログ
    console.log('📁 ファイル選択開始...');
    const fileInputHandle = await page.$('input[type="file"]');
    if (!fileInputHandle) {
      console.error('❌ File input not found');
      process.exit(1);
    }

    await fileInputHandle.uploadFile(imagePathArg);
    console.log('✅ Image uploaded');

    // 「Next」ボタンを待つ
    await page.waitForSelector('button:has-text("Next")', { timeout: 10000 });
    await page.click('button:has-text("Next")');
    console.log('✅ Clicked Next');

    // Caption入力
    if (captionArg) {
      const captionInput = page.locator('textarea').first();
      await captionInput.fill(captionArg);
      console.log('✅ Caption entered');
    }

    // 「Share」ボタン
    await page.waitForSelector('button:has-text("Share")', { timeout: 10000 });
    await page.click('button:has-text("Share")');
    console.log('✅ Clicked Share');

    // 完了待機
    await page.waitForTimeout(3000);
    console.log('🎉 Done!');

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
