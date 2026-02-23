#!/usr/bin/env node
/**
 * Instagram v8-chrome-profile
 * Chrome User Profile を直接使用 → JS実行・認証完全継承
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v8-chrome-profile.cjs <image-path> [caption]');
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v8-chrome-profile');

  // Chrome User Data Directory を探す
  let userDataDir = null;
  
  // Linux の Chrome プロファイル
  const linuxChromeDir = path.join(os.homedir(), '.config/google-chrome');
  const linuxChromiumDir = path.join(os.homedir(), '.config/chromium');
  const linuxChromiumSnapDir = path.join(os.homedir(), 'snap/chromium/common/chromium');

  if (fs.existsSync(linuxChromeDir)) {
    userDataDir = linuxChromeDir;
    console.log('✅ Found Chrome profile:', userDataDir);
  } else if (fs.existsSync(linuxChromiumDir)) {
    userDataDir = linuxChromiumDir;
    console.log('✅ Found Chromium profile:', userDataDir);
  } else if (fs.existsSync(linuxChromiumSnapDir)) {
    userDataDir = linuxChromiumSnapDir;
    console.log('✅ Found Chromium snap profile:', userDataDir);
  } else {
    console.warn('⚠️ No Chrome profile found, using fresh context');
  }

  let browser;
  let context;

  try {
    if (userDataDir && fs.existsSync(userDataDir)) {
      // launchPersistentContext を使用
      console.log('📂 Using Chrome profile:', userDataDir);
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      browser = context._browser;
    } else {
      // 通常の launch
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      context = await browser.newContext();
    }

    const pages = context.pages();
    let page = pages[0] || await context.newPage();

    // タイムアウト設定 (90秒)
    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);

    console.log('🌐 Navigating to Instagram (90s timeout)...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });
    console.log('✅ Instagram loaded');

    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('[aria-label="Create"]') || 
             !!document.querySelector('a[href="/create/"]') ||
             !!document.querySelector('svg[aria-label="Create"]');
    });
    console.log(isLoggedIn ? '✅ Logged in & Create button visible' : '⚠️ Not logged in');

    // Create button を待つ
    console.log('🔍 Waiting for Create button...');
    let createClicked = false;

    try {
      await page.locator('[aria-label="Create"]').first().click({ timeout: 10000 });
      createClicked = true;
      console.log('✅ Create button clicked');
    } catch (e1) {
      try {
        console.log('🔄 Trying alternate selector...');
        await page.locator('a[href*="/create"]').first().click({ timeout: 10000 });
        createClicked = true;
        console.log('✅ Create button clicked (alternate)');
      } catch (e2) {
        try {
          console.log('🔄 Trying SVG selector...');
          await page.locator('svg[aria-label="Create"]').first().click({ timeout: 10000 });
          createClicked = true;
          console.log('✅ Create button clicked (SVG)');
        } catch (e3) {
          // Debug: screenshot を取得
          console.error('❌ Create button not found in any selector');
          console.log('📸 Taking screenshot for debugging...');
          await page.screenshot({ path: '/tmp/instagram-create-notfound.png' });
          throw new Error('Create button not found');
        }
      }
    }

    if (!createClicked) {
      throw new Error('Failed to click Create button');
    }

    // ファイル選択
    console.log('📁 Uploading image...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ Image uploaded');

    // Next ボタンを待つ
    console.log('⏳ Waiting for Next button...');
    await page.locator('button:has-text("Next")').first().click({ timeout: 15000 });
    console.log('✅ Next clicked');

    // Caption
    if (captionArg.trim()) {
      console.log('📝 Entering caption...');
      const textarea = page.locator('textarea').first();
      await textarea.fill(captionArg);
      console.log('✅ Caption entered');
    }

    // Share
    console.log('📤 Sharing post...');
    await page.locator('button:has-text("Share")').first().click({ timeout: 15000 });
    console.log('✅ Share clicked');

    // 完了待機
    await page.waitForTimeout(3000);
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
