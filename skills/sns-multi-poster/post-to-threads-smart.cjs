#!/usr/bin/env node

/**
 * Threads 投稿スクリプト（スマート版）
 * 
 * 柔軟なセレクタで複数パターンを試す
 * 使い方:
 *   DRY_RUN=true node post-to-threads-smart.cjs <画像パス> "キャプション"
 *   node post-to-threads-smart.cjs <画像パス> "キャプション"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function findAndClick(page, patterns, description) {
  console.log(`🔍 ${description}を探索...`);
  
  for (const pattern of patterns) {
    try {
      let element;
      
      if (pattern.type === 'xpath') {
        const elements = await page.$x(pattern.selector);
        if (elements.length > 0) {
          element = elements[0];
        }
      } else {
        element = await page.$(pattern.selector);
      }
      
      if (element) {
        console.log(`✅ ${description}を発見（${pattern.name}）`);
        await element.click();
        console.log(`✅ ${description}をクリック`);
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  console.error(`❌ ${description}が見つかりません`);
  await page.screenshot({ path: `/tmp/threads-${description.replace(/\s+/g, '-')}-not-found.png` });
  return false;
}

async function main() {
  const [, , imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('使い方: node post-to-threads-smart.cjs <画像パス> "キャプション"');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 画像が見つかりません: ${imagePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(COOKIES_PATH)) {
    console.error(`❌ Cookieファイルが見つかりません: ${COOKIES_PATH}`);
    process.exit(1);
  }

  console.log('🌐 Threads 投稿スクリプト（スマート版）');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Cookie読み込み
    console.log('✅ Cookie読み込み');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);

    // Threads ホームに移動
    console.log('🌐 Threads にアクセス...');
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(3000);
    console.log('✅ ページ読み込み完了');
    await page.screenshot({ path: '/tmp/threads-smart-1-loaded.png' });

    // "What's new?" / "Start a thread..." ボタンをクリック
    const startThreadPatterns = [
      { type: 'css', selector: 'div[contenteditable="true"][aria-label="Start a thread..."]', name: 'contenteditable' },
      { type: 'css', selector: 'textarea[placeholder*="What"]', name: 'textarea' },
      { type: 'xpath', selector: '//*[contains(text(), "What") and contains(text(), "new")]', name: 'テキスト What\'s new' },
      { type: 'xpath', selector: '//*[@role="textbox" or @contenteditable="true"]', name: 'textbox' },
    ];

    if (!await findAndClick(page, startThreadPatterns, 'Start thread ボタン')) {
      process.exit(1);
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/threads-smart-2-after-click.png' });

    // キャプション入力
    console.log('📝 キャプションを入力...');
    await page.keyboard.type(caption, { delay: 50 });
    console.log('✅ キャプションを入力');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/threads-smart-3-after-caption.png' });

    // 画像添付ボタンをクリック
    const attachPatterns = [
      { type: 'css', selector: 'svg[aria-label="Attach media"]', name: 'SVGアイコン' },
      { type: 'xpath', selector: '//svg[@aria-label="Attach media"]', name: 'XPath SVG' },
      { type: 'xpath', selector: '//*[contains(@aria-label, "Attach") or contains(@aria-label, "media")]', name: 'aria-label' },
    ];

    if (!await findAndClick(page, attachPatterns, '画像添付ボタン')) {
      process.exit(1);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/threads-smart-4-after-attach.png' });

    // ファイルインプットを探す
    console.log('🔍 ファイルインプットを探索...');
    const fileInputPatterns = [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="video"]',
      'input[type="file"]',
    ];

    let fileInput = null;
    for (const selector of fileInputPatterns) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ ファイルインプットを発見（${selector}）`);
        break;
      }
    }

    if (!fileInput) {
      console.error('❌ ファイルインプットが見つかりません');
      await page.screenshot({ path: '/tmp/threads-smart-file-input-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/threads-smart-5-after-upload.png' });

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      console.log('📸 スクリーンショット: /tmp/threads-smart-*.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Post" ボタンをクリック
    const postPatterns = [
      { type: 'xpath', selector: '//button[contains(text(), "Post")]', name: 'button要素' },
      { type: 'xpath', selector: '//*[@role="button"][contains(text(), "Post")]', name: 'role=button' },
      { type: 'xpath', selector: '//*[contains(text(), "Post") and not(contains(text(), "Repost"))]', name: 'テキスト' },
    ];

    if (!await findAndClick(page, postPatterns, 'Post ボタン')) {
      process.exit(1);
    }

    // 投稿完了を待機
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/threads-smart-6-final.png' });

    console.log('==================================================');
    console.log('✅ Threads 投稿完了');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
