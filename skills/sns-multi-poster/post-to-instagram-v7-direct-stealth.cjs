#!/usr/bin/env node
/**
 * Instagram v7-direct-stealth
 * Playwright のみで stealth マスク + 60秒タイムアウト
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-v7-direct-stealth.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v7-direct-stealth');
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
    
    // Stealth 対応: webdriver フラグを削除
    await page.addInitScript(() => {
      // webdriver フラグ削除
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Chrome detection 対策
      const originalQuery = window.chrome.runtime.sendMessage;
      window.chrome.runtime.sendMessage = function(...args) {
        if (args.length === 1 && typeof args[0] === 'object') {
          return;
        }
        return originalQuery.apply(this, args);
      };

      // ローカルストレージ / セッションストレージ を有効化
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    // タイムアウト設定
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Cookie 読み込み
    console.log('🔐 Cookie読み込み...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ ${cookies.length} cookies loaded`);
    } else {
      console.warn('⚠️ Cookie not found');
    }

    // Instagram アクセス (60秒 + waitUntil domcontentloaded)
    console.log('🌐 Accessing Instagram (waitUntil: domcontentloaded, 60s timeout)...');
    try {
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      console.log('✅ Page loaded');
    } catch (err) {
      console.error('❌ Navigation failed:', err.message);
      
      // 代替: load イベントのみ待つ
      console.log('🔄 Retrying with "load" waitUntil...');
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'load',
        timeout: 90000,
      });
      console.log('✅ Page loaded (load event)');
    }

    // ログイン状態確認
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('a[href="/"]');
    });
    console.log(isLoggedIn ? '✅ Logged in' : '⚠️ Not logged in');

    // Create button を探す
    console.log('🔍 Looking for Create button...');
    const createBtn = page.locator('[aria-label="Create"]').first();
    
    try {
      await createBtn.click({ timeout: 5000 });
      console.log('✅ Create button clicked');
    } catch (e) {
      console.error('❌ Create button failed:', e.message);
      
      // Fallback: href で探す
      console.log('🔄 Trying fallback selector...');
      const fallbackBtn = page.locator('a[href*="/create"]').first();
      await fallbackBtn.click({ timeout: 5000 });
      console.log('✅ Create button clicked (fallback)');
    }

    // ファイル選択
    console.log('📁 Uploading image...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ Image uploaded');

    // Next ボタン
    console.log('⏳ Waiting for Next button...');
    await page.locator('button:has-text("Next")').first().click({ timeout: 10000 });
    console.log('✅ Next clicked');

    // Caption
    if (captionArg.trim()) {
      console.log('📝 Entering caption...');
      const textarea = page.locator('textarea').first();
      await textarea.fill(captionArg);
      console.log('✅ Caption entered');
    }

    // Share ボタン
    console.log('📤 Sharing...');
    await page.locator('button:has-text("Share")').first().click({ timeout: 10000 });
    console.log('✅ Share clicked');

    // 完了待機
    await page.waitForTimeout(3000);
    console.log('🎉 Post completed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
