#!/usr/bin/env node
/**
 * Instagram Direct Upload (タイムアウト問題回避版)
 * /create/select に直接アクセス + DOM要素待機方式
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-direct.cjs <image-path> [caption]');
  process.exit(1);
}

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
  console.log('🚀 Instagram Direct Upload - DOM element waiting');

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
    page.setDefaultTimeout(60000);

    // 直接 /create/select にアクセス
    console.log('🌐 Loading /create/select directly...');
    await page.goto('https://www.instagram.com/create/select/', {
      waitUntil: 'commit', // 最小限の待機
      timeout: 60000,
    });

    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Cookies are invalid - redirected to login page');
    }

    // ファイル入力を待つ
    console.log('⏳ Waiting for file input...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    console.log('✅ File input found');

    // ファイルアップロード
    console.log('📁 Uploading file...');
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ File uploaded');

    // Nextボタンを待つ
    console.log('⏳ Waiting for Next button...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Next button visible');

    // スクリーンショット取得
    const screenshotPath = path.join(__dirname, 'debug-before-next-click.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Nextボタンをクリック
    console.log('🖱️ Clicking Next button...');
    await nextBtn.click();
    console.log('✅ Next button clicked');

    // エラーメッセージをチェック
    console.log('⏳ Waiting for page transition (5s)...');
    await page.waitForTimeout(5000);

    const errorMessage = await page.locator('text="Something went wrong"').first().isVisible().catch(() => false);
    if (errorMessage) {
      console.error('❌ "Something went wrong" error detected');
      const errorScreenshotPath = path.join(__dirname, 'debug-error-page.png');
      await page.screenshot({ path: errorScreenshotPath, fullPage: true });
      console.log(`📸 Error screenshot saved: ${errorScreenshotPath}`);
      throw new Error('"Something went wrong" error appeared');
    }

    console.log('✅ No error detected - proceeding...');

    // キャプション入力フィールドを待つ
    console.log('⏳ Waiting for caption field...');
    const captionField = page.locator('textarea[aria-label*="caption" i]').or(page.locator('textarea[placeholder*="caption" i]')).first();
    await captionField.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Caption field found');

    // キャプション入力
    if (captionArg) {
      console.log('⌨️ Typing caption...');
      await captionField.fill(captionArg);
      console.log('✅ Caption entered');
    }

    // Shareボタンを待つ
    console.log('⏳ Waiting for Share button...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    await shareBtn.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Share button visible');

    // DRY RUN チェック
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: Not clicking Share button');
      const dryRunScreenshotPath = path.join(__dirname, 'debug-dry-run-before-share.png');
      await page.screenshot({ path: dryRunScreenshotPath, fullPage: true });
      console.log(`📸 DRY RUN screenshot saved: ${dryRunScreenshotPath}`);
      console.log('✅ DRY RUN completed successfully');
      return;
    }

    // Shareボタンをクリック
    console.log('🖱️ Clicking Share button...');
    await shareBtn.click();
    console.log('✅ Share button clicked');

    // 投稿完了を待つ
    console.log('⏳ Waiting for post completion...');
    await page.waitForTimeout(5000);

    // 成功確認
    const postSharedMessage = await page.locator('text=/Post shared|Your post has been shared/i').first().isVisible().catch(() => false);
    if (postSharedMessage) {
      console.log('✅ Post shared successfully');
    } else {
      console.log('⚠️ Could not confirm post success - please check Instagram');
    }

    console.log('✅ Instagram post completed');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
