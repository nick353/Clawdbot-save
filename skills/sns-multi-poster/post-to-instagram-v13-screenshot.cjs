#!/usr/bin/env node
/**
 * Instagram v13-screenshot
 * 各ステップでスクリーンショット撮影して確認
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';
const dryRun = process.env.DRY_RUN === 'true';

const SCREENSHOT_DIR = '/tmp/instagram-visual-debug';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v13-screenshot.cjs <image-path> [caption]');
  process.exit(1);
}

// スクリーンショット撮影
async function takeScreenshot(page, name) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 スクリーンショット: ${filepath}`);
  return filepath;
}

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      const fixedCookies = cookies.map(c => ({
        name: c.name,
        value: decodeURIComponent(c.value),
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
        expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
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
  console.log('🚀 Instagram v13-screenshot - Visual debug mode');
  if (dryRun) console.log('🔄 DRY RUN MODE');

  let browser;
  let context;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);

    // Step 1: ホームページに遷移
    console.log('📄 Step 1: Instagram homepage');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '01-homepage');

    // Step 2: /create/ に遷移
    console.log('📄 Step 2: Navigate to /create/');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      await takeScreenshot(page, '02-error-login');
      throw new Error('Cookies are invalid - still on login page');
    }
    await takeScreenshot(page, '02-create-page');

    // Step 3: ファイル入力を探してアップロード
    console.log('📁 Step 3: Upload file');
    
    const fileSelectors = [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]',
    ];

    let fileInput = null;
    for (const selector of fileSelectors) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ File input found: ${selector}`);
        break;
      }
    }

    if (!fileInput) {
      await takeScreenshot(page, '03-error-no-file-input');
      throw new Error('❌ File input not found');
    }

    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ File uploaded');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '03-after-upload');

    // Step 4: 「Next」ボタン（1回目）
    console.log('🔘 Step 4: Click Next (1st time)');
    
    let nextButton = null;
    for (let i = 0; i < 10; i++) {
      nextButton = await page.getByRole('button', { name: /Next/i }).first();
      if (await nextButton.isVisible().catch(() => false)) {
        console.log(`✅ Next button found after ${i} seconds`);
        break;
      }
      await page.waitForTimeout(1000);
      console.log(`  Still waiting (${i}s)...`);
    }

    if (!nextButton || !await nextButton.isVisible().catch(() => false)) {
      await takeScreenshot(page, '04-error-no-next-button');
      throw new Error('❌ Next button not found');
    }

    await takeScreenshot(page, '04-before-next-click');
    await nextButton.click();
    console.log('✅ Next clicked');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '04-after-next-click');

    // Step 5: 「Next」ボタン（2回目）
    console.log('🔘 Step 5: Check if 2nd Next needed');
    
    const allButtons = await page.getByRole('button').all();
    const buttonTexts = await Promise.all(
      allButtons.map(async btn => {
        try {
          return await btn.textContent();
        } catch {
          return '';
        }
      })
    );
    console.log(`📊 Buttons: ${JSON.stringify(buttonTexts)}`);

    if (buttonTexts.some(text => text && text.match(/Next/i))) {
      console.log('🔄 Need to click Next again...');
      const secondNext = await page.getByRole('button', { name: /Next/i }).first();
      await takeScreenshot(page, '05-before-second-next');
      await secondNext.click();
      console.log('✅ Next clicked (2nd time)');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '05-after-second-next');
    } else {
      console.log('✅ Only one Next needed');
    }

    // Step 6: キャプション入力
    console.log('📝 Step 6: Enter caption');
    
    const captionSelectors = [
      'textarea[aria-label*="caption"]',
      'textarea[placeholder*="caption"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea',
    ];

    let captionField = null;
    for (const selector of captionSelectors) {
      captionField = await page.$(selector);
      if (captionField) {
        console.log(`✅ Caption field found: ${selector}`);
        break;
      }
    }

    if (!captionField) {
      await takeScreenshot(page, '06-error-no-caption-field');
      throw new Error('❌ Caption field not found');
    }

    await takeScreenshot(page, '06-before-caption');
    await captionField.fill(captionArg);
    console.log('✅ Caption entered');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '06-after-caption');

    // Step 7: 「Share」ボタンをクリック
    console.log('📤 Step 7: Click Share');
    
    if (dryRun) {
      console.log('🔄 DRY RUN: Share button not clicked');
      await takeScreenshot(page, '07-dry-run-final');
      console.log('✅ DRY RUN completed successfully');
      return;
    }

    let shareButton = null;
    for (let i = 0; i < 10; i++) {
      const buttons = await page.getByRole('button').all();
      for (const btn of buttons) {
        try {
          const text = await btn.textContent();
          if (text && text.match(/Share/i)) {
            const visible = await btn.isVisible().catch(() => false);
            if (visible) {
              shareButton = btn;
              console.log(`✅ Share button found: "${text}"`);
              break;
            }
          }
        } catch {}
      }
      if (shareButton) break;
      await page.waitForTimeout(1000);
      console.log(`  Still waiting for Share (${i}s)...`);
    }

    if (!shareButton) {
      await takeScreenshot(page, '07-error-no-share-button');
      throw new Error('❌ Share button not found');
    }

    await takeScreenshot(page, '07-before-share');
    await shareButton.click();
    console.log('✅ Share clicked');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '07-after-share');

    console.log('🎉 Post published successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (context) {
      const page = context.pages()[0];
      if (page) {
        await takeScreenshot(page, 'error-final');
      }
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
