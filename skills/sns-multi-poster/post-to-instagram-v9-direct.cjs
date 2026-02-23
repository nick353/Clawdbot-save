#!/usr/bin/env node
/**
 * Instagram v9-direct
 * 直接 /create URL にアクセス → Create フロー を確実に開く
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v9-direct.cjs <image-path> [caption]');
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v9-direct - Direct /create URL');

  let browser;
  let context;

  try {
    // Chrome User Data Directory を探す
    let userDataDir = null;
    const linuxChromeDir = path.join(os.homedir(), '.config/google-chrome');
    const linuxChromiumDir = path.join(os.homedir(), '.config/chromium');

    if (fs.existsSync(linuxChromeDir)) {
      userDataDir = linuxChromeDir;
      console.log('✅ Found Chrome profile:', userDataDir);
    } else if (fs.existsSync(linuxChromiumDir)) {
      userDataDir = linuxChromiumDir;
      console.log('✅ Found Chromium profile:', userDataDir);
    }

    // Launch browser
    if (userDataDir && fs.existsSync(userDataDir)) {
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

    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);

    // Step 1: Home を読み込み (認証確認)
    console.log('🌐 Step 1: Loading Instagram home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });

    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !!document.body.innerText.includes('Inbox') || 
             !!document.querySelector('[aria-label="Inbox"]');
    });
    if (!isLoggedIn) {
      console.warn('⚠️ May not be logged in, continuing anyway...');
    } else {
      console.log('✅ Logged in confirmed');
    }

    // Step 2: 直接 /create URL にナビゲート
    console.log('🌐 Step 2: Navigating directly to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });
    console.log('✅ /create page loaded');

    // Step 3: 画像アップロード
    console.log('📁 Step 3: Looking for file input...');
    
    // 複数の方法でファイル入力を探す
    let fileInputs = await page.locator('input[type="file"]').all();
    console.log(`📊 Found ${fileInputs.length} file inputs`);

    if (fileInputs.length === 0) {
      // より広い検索
      fileInputs = await page.locator('input').all();
      console.log(`📊 Found ${fileInputs.length} total inputs`);
      
      // デバッグ: 最初の10個のinputを調査
      for (let i = 0; i < Math.min(10, fileInputs.length); i++) {
        const type = await fileInputs[i].getAttribute('type');
        const name = await fileInputs[i].getAttribute('name');
        const id = await fileInputs[i].getAttribute('id');
        console.log(`  Input ${i}: type=${type}, name=${name}, id=${id}`);
      }
    }

    // ファイル入力を試す
    let uploaded = false;
    for (const input of fileInputs) {
      try {
        const type = await input.getAttribute('type');
        if (type === 'file') {
          console.log('📁 Uploading file...');
          await input.setInputFiles(imagePathArg);
          uploaded = true;
          console.log('✅ File uploaded successfully');
          break;
        }
      } catch (e) {
        console.log(`  Skipping input: ${e.message}`);
      }
    }

    if (!uploaded) {
      // Alternative: ドラッグドロップ領域を探す
      console.log('🔄 Trying alternate: looking for drag-drop area...');
      const dropAreas = await page.locator('[role="button"]').all();
      console.log(`📊 Found ${dropAreas.length} button-role elements`);
      
      if (dropAreas.length > 0) {
        // 最初のボタンをクリック
        await dropAreas[0].click();
        await page.waitForTimeout(1000);
        
        // ファイル入力を再度探す
        const newFileInputs = await page.locator('input[type="file"]').all();
        if (newFileInputs.length > 0) {
          console.log('📁 File input appeared after click, uploading...');
          await newFileInputs[0].setInputFiles(imagePathArg);
          uploaded = true;
          console.log('✅ File uploaded successfully');
        }
      }
    }

    if (!uploaded) {
      throw new Error('Failed to upload file - no file input found');
    }

    // Step 4: Next ボタンを待つ・クリック
    console.log('⏳ Step 4: Waiting for Next button...');
    
    const nextSelectors = [
      'button:has-text("Next")',
      'button:text("Next")',
      'button[type="button"]:has-text("Next")',
    ];

    let nextClicked = false;
    for (const selector of nextSelectors) {
      try {
        const nextBtn = page.locator(selector).first();
        if (await nextBtn.isVisible({ timeout: 5000 })) {
          await nextBtn.click({ timeout: 10000 });
          nextClicked = true;
          console.log('✅ Next button clicked');
          break;
        }
      } catch (e) {
        console.log(`  Selector "${selector}" not available`);
      }
    }

    if (!nextClicked) {
      // スクリーンショットを取得してデバッグ
      await page.screenshot({ path: '/tmp/instagram-next-notfound.png' });
      throw new Error('Next button not found');
    }

    // Step 5: Caption (オプション)
    if (captionArg.trim()) {
      console.log('📝 Step 5: Entering caption...');
      const textareas = await page.locator('textarea').all();
      if (textareas.length > 0) {
        await textareas[0].fill(captionArg);
        console.log('✅ Caption entered');
      } else {
        console.warn('⚠️ No textarea found for caption');
      }
    }

    // Step 6: Share ボタン
    console.log('📤 Step 6: Clicking Share button...');
    
    const shareSelectors = [
      'button:has-text("Share")',
      'button:text("Share")',
      'button[type="button"]:has-text("Share")',
    ];

    let shareClicked = false;
    for (const selector of shareSelectors) {
      try {
        const shareBtn = page.locator(selector).first();
        if (await shareBtn.isVisible({ timeout: 5000 })) {
          await shareBtn.click({ timeout: 15000 });
          shareClicked = true;
          console.log('✅ Share button clicked');
          break;
        }
      } catch (e) {
        console.log(`  Selector "${selector}" not available`);
      }
    }

    if (!shareClicked) {
      await page.screenshot({ path: '/tmp/instagram-share-notfound.png' });
      throw new Error('Share button not found');
    }

    // Step 7: 完了確認
    console.log('⏳ Waiting for post completion...');
    await page.waitForTimeout(3000);
    
    const successPatterns = [
      'Your post has been shared',
      'posted',
      'shared',
    ];
    
    const pageText = await page.locator('body').textContent();
    const success = successPatterns.some(pattern => pageText.includes(pattern));
    
    if (success) {
      console.log('🎉 Post completed successfully!');
    } else {
      console.log('⚠️ Share button clicked but success not confirmed');
      console.log('📸 Taking final screenshot...');
      await page.screenshot({ path: '/tmp/instagram-final.png' });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
