#!/usr/bin/env node
/**
 * Instagram 投稿デバッグ - 詳細ステップ記録
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: debug-instagram-post-detail.cjs <image-path> [caption]');
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

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, `debug-step-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: debug-step-${name}.png`);
  return screenshotPath;
}

async function main() {
  console.log('🔍 Instagram Post Detail Debug');

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

    // Step 1: トップページ
    console.log('🌐 Step 1: Loading Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'commit',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '01-top-page');

    // Step 2: /create/select に移動
    console.log('🌐 Step 2: Loading /create/select...');
    await page.goto('https://www.instagram.com/create/select/', {
      waitUntil: 'commit',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02-create-select');

    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Cookies are invalid - redirected to login page');
    }

    // Step 3: ファイル入力を待つ
    console.log('⏳ Step 3: Waiting for file input...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    console.log('✅ File input found');

    // Step 4: ファイルアップロード
    console.log('📁 Step 4: Uploading file...');
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ File uploaded');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-after-upload');

    // Step 5: Nextボタンを待つ
    console.log('⏳ Step 5: Waiting for Next button...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Next button visible');
    await takeScreenshot(page, '04-before-next-click');

    // Step 6: Nextボタンをクリック
    console.log('🖱️ Step 6: Clicking Next button...');
    await nextBtn.click();
    console.log('✅ Next button clicked');
    
    // 即座にスクリーンショット
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '05-just-after-next-click');

    // Step 7: ページ遷移を待つ
    console.log('⏳ Step 7: Waiting for page transition...');
    await page.waitForTimeout(5000);
    await takeScreenshot(page, '06-after-5sec-wait');

    // エラーメッセージをチェック
    const errorMessage = await page.locator('text="Something went wrong"').first().isVisible().catch(() => false);
    if (errorMessage) {
      console.error('❌ "Something went wrong" error detected');
      await takeScreenshot(page, '07-error-detected');
      
      // エラーメッセージの詳細を取得
      const errorText = await page.locator('text="Something went wrong"').first().textContent().catch(() => 'N/A');
      console.error(`Error text: ${errorText}`);
      
      throw new Error('"Something went wrong" error appeared');
    }

    console.log('✅ No error detected');

    // Step 8: ページの状態を確認
    console.log('🔍 Step 8: Checking page state...');
    const pageContent = await page.content();
    
    // キャプションフィールドを探す
    const captionFieldVisible = await page.locator('textarea').first().isVisible().catch(() => false);
    console.log(`Caption field visible: ${captionFieldVisible}`);
    
    // Nextボタンがまだあるか確認
    const nextBtnStillVisible = await page.locator('button:has-text("Next")').first().isVisible().catch(() => false);
    console.log(`Next button still visible: ${nextBtnStillVisible}`);
    
    // Shareボタンがあるか確認
    const shareBtnVisible = await page.locator('button:has-text("Share")').first().isVisible().catch(() => false);
    console.log(`Share button visible: ${shareBtnVisible}`);
    
    await takeScreenshot(page, '08-final-state');

    // DOM要素を列挙
    console.log('📋 Visible buttons:');
    const buttons = await page.locator('button').all();
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].textContent().catch(() => '');
      const visible = await buttons[i].isVisible().catch(() => false);
      if (visible && text) {
        console.log(`  - "${text}"`);
      }
    }

    console.log('📋 Visible textareas:');
    const textareas = await page.locator('textarea').all();
    for (let i = 0; i < textareas.length; i++) {
      const ariaLabel = await textareas[i].getAttribute('aria-label').catch(() => '');
      const placeholder = await textareas[i].getAttribute('placeholder').catch(() => '');
      const visible = await textareas[i].isVisible().catch(() => false);
      if (visible) {
        console.log(`  - aria-label: "${ariaLabel}", placeholder: "${placeholder}"`);
      }
    }

    console.log('✅ Debug completed');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (context) {
      const page = context.pages()[0];
      if (page) {
        await takeScreenshot(page, '99-error-state');
      }
    }
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
