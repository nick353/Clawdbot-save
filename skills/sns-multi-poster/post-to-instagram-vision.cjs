#!/usr/bin/env node
/**
 * Instagram自動投稿 - Vision + Playwright版
 * Claudeが画面を見ながら操作を進める Computer Use 的アプローチ
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIE_FILE = path.join(__dirname, 'cookies', 'instagram.json');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `vision-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

async function waitForUserConfirmation(prompt) {
  console.log(`\n⏸️  PAUSE - ${prompt}`);
  console.log('Press Enter to continue...');
  // 本来はreadlineで待つが、今回は自動化のためスキップ
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function main() {
  const [,, imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('Usage: node post-to-instagram-vision.cjs <image_path> <caption>');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    process.exit(1);
  }

  console.log('🐥 Instagram自動投稿（Vision版）');
  console.log(`📸 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption}`);

  // Cookie読み込み
  let cookies = [];
  if (fs.existsSync(COOKIE_FILE)) {
    cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
    console.log('🍪 Cookie loaded');
  } else {
    console.error(`❌ Cookie file not found: ${COOKIE_FILE}`);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Step 1: Instagramを開く
    console.log('\n📍 Step 1: Opening Instagram...');
    await page.goto('https://www.instagram.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'step-01-home');

    // Step 2: 新規投稿ボタンを探す
    console.log('\n📍 Step 2: Looking for "Create" button...');
    
    // Vision prompt for Claude:
    console.log(`
🔍 Claude Vision Analysis Request:
- 画面に「新規投稿」「作成」「Create」ボタンはありますか？
- ある場合、どの位置にありますか？（左サイドバー、上部ナビ、など）
- aria-label または text で識別できますか？

📸 Screenshot: ${path.join(SCREENSHOT_DIR, 'vision-step-01-home.png')}
    `);

    await waitForUserConfirmation('Claude に画面を確認してもらい、次のステップを決定');

    // Step 3: "Create" ボタンをクリック（仮定: aria-label="New post"）
    console.log('\n📍 Step 3: Clicking "Create" button...');
    
    // 複数のセレクタを試す
    const createSelectors = [
      'a[aria-label*="New post"]',
      'a[aria-label*="Create"]',
      'a[aria-label*="新規投稿"]',
      'svg[aria-label*="New post"]',
      'svg[aria-label*="Create"]'
    ];

    let createButton = null;
    for (const selector of createSelectors) {
      createButton = await page.$(selector);
      if (createButton) {
        console.log(`✅ Found: ${selector}`);
        break;
      }
    }

    if (!createButton) {
      console.error('❌ "Create" button not found. Taking screenshot for analysis...');
      await takeScreenshot(page, 'step-03-error-no-create-button');
      throw new Error('Create button not found');
    }

    await createButton.click();
    console.log('⏳ Waiting for menu to expand...');
    await page.waitForTimeout(1000);

    // メニューが展開されるまで確実に待つ
    const postSelectors = [
      'text=Post',
      'span:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      'a:has-text("Post")'
    ];

    let postButton = null;
    for (const selector of postSelectors) {
      try {
        // 最大5秒待つ（確実にメニューが表示されるまで）
        postButton = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        if (postButton) {
          console.log(`✅ Found Post button (visible): ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️ Selector not found: ${selector}`);
      }
    }

    await takeScreenshot(page, 'step-03-after-create-click-menu');

    if (!postButton) {
      console.error('❌ "Post" button not found in submenu');
      await takeScreenshot(page, 'step-03-5-error-no-post');
      
      console.log(`
🔍 Claude Vision Analysis Request:
- Create ボタンをクリックした後、メニューは展開されていますか？
- 「Post」「Story」「Reel」などのオプションは表示されていますか？
- どのボタンをクリックすれば投稿モーダルが開きますか？

📸 Screenshot: ${path.join(SCREENSHOT_DIR, 'vision-step-03-5-error-no-post.png')}
      `);
      
      throw new Error('Post button not found');
    }

    // Step 3.5: "Post" サブメニューをクリック
    console.log('\n📍 Step 3.5: Clicking "Post" submenu...');
    await postButton.click();
    console.log('⏳ Waiting for modal to open...');
    
    // モーダルが開くまで待つ（より確実に）
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('⚠️ Network not idle, continuing anyway...');
    });
    
    await takeScreenshot(page, 'step-03-5-after-post-click');

    // Step 4: モーダルの存在を確認
    console.log('\n📍 Step 4: Checking for modal...');
    
    const modalSelectors = [
      'div[role="dialog"]',
      'div[aria-label*="Create"]',
      'div[aria-label*="新規投稿"]'
    ];

    let modal = null;
    for (const selector of modalSelectors) {
      modal = await page.$(selector);
      if (modal) {
        console.log(`✅ Modal found: ${selector}`);
        break;
      }
    }

    if (!modal) {
      console.log('⚠️ Modal not found, taking screenshot for analysis...');
      await takeScreenshot(page, 'step-04-no-modal');
      
      console.log(`
🔍 Claude Vision Analysis Request:
- モーダルウィンドウは開いていますか？
- 開いていない場合、どのボタンをクリックすれば開きますか？

📸 Screenshot: ${path.join(SCREENSHOT_DIR, 'vision-step-04-no-modal.png')}
      `);
      
      throw new Error('Modal not found after clicking Post');
    }

    // Step 5: ファイル選択モーダルを待つ
    console.log('\n📍 Step 5: Waiting for file input...');
    
    const fileInputSelectors = [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]'
    ];

    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        fileInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (fileInput) {
          console.log(`✅ Found file input: ${selector}`);
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (!fileInput) {
      console.error('❌ File input not found. Taking screenshot for analysis...');
      await takeScreenshot(page, 'step-04-error-no-file-input');
      
      console.log(`
🔍 Claude Vision Analysis Request:
- ファイル選択モーダルは表示されていますか？
- 「Select from computer」「コンピューターから選択」ボタンはありますか？
- どのような操作が必要ですか？

📸 Screenshot: ${path.join(SCREENSHOT_DIR, 'vision-step-04-error-no-file-input.png')}
      `);
      
      throw new Error('File input not found');
    }

    // Step 5: ファイルをアップロード
    console.log('\n📍 Step 5: Uploading file...');
    await fileInput.setInputFiles(path.resolve(imagePath));
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'step-05-after-upload');

    // Step 6: "Next" ボタンを探してクリック
    console.log('\n📍 Step 6: Looking for "Next" button...');
    
    const nextSelectors = [
      'button:has-text("Next")',
      'button:has-text("次へ")',
      'div[role="button"]:has-text("Next")',
      'div[role="button"]:has-text("次へ")'
    ];

    let nextButton = null;
    for (const selector of nextSelectors) {
      try {
        nextButton = await page.waitForSelector(selector, { timeout: 3000 });
        if (nextButton) {
          console.log(`✅ Found Next button: ${selector}`);
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (!nextButton) {
      console.log('⚠️ "Next" button not found, trying manual analysis...');
      await takeScreenshot(page, 'step-06-error-no-next');
      throw new Error('Next button not found');
    }

    await nextButton.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'step-06-after-next');

    // Step 7: キャプション入力
    console.log('\n📍 Step 7: Entering caption...');
    
    const captionSelectors = [
      'textarea[aria-label*="caption"]',
      'textarea[aria-label*="キャプション"]',
      'div[contenteditable="true"][aria-label*="caption"]',
      'div[contenteditable="true"][aria-label*="キャプション"]'
    ];

    let captionField = null;
    for (const selector of captionSelectors) {
      try {
        captionField = await page.waitForSelector(selector, { timeout: 3000 });
        if (captionField) {
          console.log(`✅ Found caption field: ${selector}`);
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (!captionField) {
      console.error('❌ Caption field not found');
      await takeScreenshot(page, 'step-07-error-no-caption');
      throw new Error('Caption field not found');
    }

    await captionField.click();
    await captionField.fill(caption);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'step-07-after-caption');

    // Step 8: 最後の "Share" ボタンをクリック
    console.log('\n📍 Step 8: Clicking "Share" button...');
    
    const shareSelectors = [
      'button:has-text("Share")',
      'button:has-text("シェア")',
      'div[role="button"]:has-text("Share")',
      'div[role="button"]:has-text("シェア")'
    ];

    let shareButton = null;
    for (const selector of shareSelectors) {
      try {
        shareButton = await page.waitForSelector(selector, { timeout: 3000 });
        if (shareButton) {
          console.log(`✅ Found Share button: ${selector}`);
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (!shareButton) {
      console.error('❌ Share button not found');
      await takeScreenshot(page, 'step-08-error-no-share');
      throw new Error('Share button not found');
    }

    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: Skipping final "Share" click');
      await takeScreenshot(page, 'step-08-dry-run-final');
    } else {
      await shareButton.click();
      await page.waitForTimeout(5000);
      await takeScreenshot(page, 'step-08-after-share');
      console.log('✅ Post submitted!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await takeScreenshot(page, 'step-99-error');
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
