#!/usr/bin/env node
/**
 * Instagram 投稿 - Vision確認版
 * 各ステップでスクリーンショットを取得して確認してから次に進む
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-with-vision.cjs <image-path> [caption]');
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
  const screenshotPath = path.join(__dirname, `vision-step-${name}.png`);
  // fullPage: false にして軽量化
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: false,
    timeout: 30000  // タイムアウト延長
  });
  console.log(`📸 Screenshot saved: vision-step-${name}.png`);
  return screenshotPath;
}

async function main() {
  console.log('🚀 Instagram Post - Vision-guided version');

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

    // Step 1: トップページにアクセス
    console.log('🌐 Step 1: Loading Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',  // 軽量化
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '01-top');
    console.log('⏸️ PAUSE - Please confirm screenshot shows Instagram top page');

    // Step 2: Createボタンをクリック
    console.log('🖱️ Step 2: Clicking Create button...');
    
    const createSelectors = [
      'a[href="#"]:has(svg[aria-label="New post"])',
      'a[href="#"]:has(svg[aria-label="Create"])',
      'a:has-text("Create")',
      'svg[aria-label="New post"]',
      'svg[aria-label="Create"]',
    ];

    let createBtn = null;
    for (const selector of createSelectors) {
      try {
        createBtn = page.locator(selector).first();
        const visible = await createBtn.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          console.log(`✅ Found Create button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!createBtn) {
      console.error('❌ Create button not found');
      await takeScreenshot(page, '02-create-btn-not-found');
      console.log('⏸️ PAUSE - Please check screenshot');
      throw new Error('Create button not found');
    }

    await createBtn.click();
    console.log('✅ Create button clicked');
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '03-after-create-click');
    console.log('⏸️ PAUSE - Please confirm menu is expanded with "Post" option');

    // Step 2.5: Postオプションをクリック
    console.log('🖱️ Step 2.5: Clicking Post option...');
    
    // 複数のセレクタを試す
    const postSelectors = [
      'a[role="link"]:has-text("Post")',
      'a:has-text("Post")',
      'div[role="button"]:has-text("Post")',
    ];
    
    let postOption = null;
    for (const selector of postSelectors) {
      try {
        postOption = page.locator(selector).first();
        const visible = await postOption.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          console.log(`✅ Found Post option with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!postOption) {
      console.error('❌ Post option not found');
      await takeScreenshot(page, '04-post-option-not-found');
      throw new Error('Post option not found');
    }
    
    // JavaScript クリックも試す
    await postOption.evaluate(el => el.click()).catch(async () => {
      // 通常のクリックにフォールバック
      await postOption.click();
    });
    console.log('✅ Post option clicked');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04-after-post-click');
    console.log('⏸️ PAUSE - Please confirm modal is open for file selection');

    // Step 3: ファイル選択ダイアログが開くのを待つ
    console.log('⏳ Step 3: Waiting for file input...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    console.log('✅ File input found');

    // Step 4: ファイルアップロード
    console.log('📁 Step 4: Uploading file...');
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ File uploaded');
    await page.waitForTimeout(4000);
    await takeScreenshot(page, '05-after-upload');
    console.log('⏸️ PAUSE - Please confirm image is displayed');

    // Step 5: Nextボタンを待つ
    console.log('⏳ Step 5: Waiting for Next button...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Next button visible');
    await takeScreenshot(page, '06-before-next');
    console.log('⏸️ PAUSE - Please confirm Next button is clickable');

    // Step 6: Nextボタンをクリック
    console.log('🖱️ Step 6: Clicking Next button...');
    await nextBtn.click();
    console.log('✅ Next button clicked');
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '07-after-next');
    console.log('⏸️ PAUSE - Please confirm moved to next screen');

    // エラーチェック
    const errorMessage = await page.locator('text="Something went wrong"').first().isVisible().catch(() => false);
    if (errorMessage) {
      console.error('❌ "Something went wrong" error detected');
      await takeScreenshot(page, '08-error');
      console.log('⏸️ PAUSE - Error detected, check screenshot');
      throw new Error('"Something went wrong" error appeared');
    }

    // 2回目のNextボタンがあるかチェック
    const nextBtn2Visible = await page.locator('button:has-text("Next")').first().isVisible().catch(() => false);
    if (nextBtn2Visible) {
      console.log('🖱️ Step 6.5: Clicking 2nd Next button...');
      const nextBtn2 = page.locator('button:has-text("Next")').first();
      await nextBtn2.click();
      console.log('✅ 2nd Next button clicked');
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '07b-after-2nd-next');
      console.log('⏸️ PAUSE - Please confirm moved to caption screen');
    }

    // Step 7: キャプションフィールドを待つ
    console.log('⏳ Step 7: Waiting for caption field...');
    const captionField = page.locator('textarea[aria-label*="caption" i]').or(
      page.locator('textarea[placeholder*="caption" i]')
    ).first();
    await captionField.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Caption field found');
    await takeScreenshot(page, '08-caption-field');
    console.log('⏸️ PAUSE - Please confirm caption field is visible');

    // Step 8: キャプション入力
    if (captionArg) {
      console.log('⌨️ Step 8: Typing caption...');
      await captionField.fill(captionArg);
      console.log('✅ Caption entered');
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '09-caption-entered');
      console.log('⏸️ PAUSE - Please confirm caption is entered');
    }

    // Step 9: Shareボタンを待つ
    console.log('⏳ Step 9: Waiting for Share button...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    await shareBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log('✅ Share button visible');
    await takeScreenshot(page, '10-before-share');
    console.log('⏸️ PAUSE - Please confirm Share button is clickable');

    // DRY RUN チェック
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: Not clicking Share button');
      await takeScreenshot(page, '11-dry-run-final');
      console.log('✅ DRY RUN completed successfully');
      return;
    }

    // Step 10: Shareボタンをクリック
    console.log('🖱️ Step 10: Clicking Share button...');
    await shareBtn.click();
    console.log('✅ Share button clicked');
    await page.waitForTimeout(5000);
    await takeScreenshot(page, '12-after-share');
    console.log('⏸️ PAUSE - Please confirm post is shared');

    // 成功確認
    const postSharedMessage = await page.locator('text=/Post shared|Your post has been shared/i').first().isVisible().catch(() => false);
    if (postSharedMessage) {
      console.log('✅ Post shared successfully');
    } else {
      console.log('⚠️ Could not confirm post success - please check screenshot');
    }

    console.log('✅ Instagram post completed');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (context) {
      const page = context.pages()[0];
      if (page) {
        await takeScreenshot(page, '99-error');
        console.log('⏸️ PAUSE - Error occurred, check screenshot');
      }
    }
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
