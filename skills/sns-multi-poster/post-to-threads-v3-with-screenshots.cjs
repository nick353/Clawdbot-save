#!/usr/bin/env node
/**
 * Threads 投稿スクリプト v3 - スクリーンショット強化版
 * 各ステップでビジュアル確認
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const {
  checkRateLimit,
  logPost,
  isAllowedPostingTime,
  randomDelay,
  getRandomUserAgent,
  bypassChromeDetection,
  config,
} = require('./lib/anti-ban-helpers.js');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-threads-v3-with-screenshots.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');
const DEBUG_DIR = '/tmp/threads-visual-debug';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function main() {
  // BAN対策: 事前チェック
  console.log('🛡️  BAN対策チェック (Threads)...');

  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Threads投稿スキップ');
    console.log('📷 画像:', imagePath);
    console.log('📝 キャプション:', caption);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  // 時間帯制限を一時的に無効化（2026-02-24）
  // if (!isAllowedPostingTime()) {
  //   console.error('❌ 投稿禁止時間帯です（7時〜23時のみ許可）');
  //   process.exit(1);
  // }

  if (!(await checkRateLimit('threads'))) {
    console.error('❌ レート制限超過（Threads: 4投稿/時間、25投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('📸 Threads 投稿開始 (v3 - スクリーンショット強化版)');

  const userAgent = getRandomUserAgent();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: config.browserArgs,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(userAgent);
    await bypassChromeDetection(page);
    await page.emulateTimezone('Asia/Tokyo');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // Cookie設定
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.threads.net',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'None'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    await randomDelay(2000, 5000);

    console.log('🔄 Step 1: Navigate to Threads');
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('✅ Threads読み込み完了');

    await randomDelay(8000, 12000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/01-page-loaded.png');
    await page.screenshot({ path: DEBUG_DIR + '/01-page-loaded.png' });

    // 新規投稿ボタン
    console.log('🔄 Step 2: Click Create button');
    await page.click('svg[aria-label="Create"], [aria-label="Create"]');
    await randomDelay(2000, 4000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/02-create-clicked.png');
    await page.screenshot({ path: DEBUG_DIR + '/02-create-clicked.png' });

    // ファイルアップロード（複数セレクタでフォールバック）
    console.log('📷 Step 3: Upload file');
    const fileSelectors = [
      'input[type="file"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="video"]',
      'input[accept="image/*,video/*"]',
      '[data-testid="file-upload-input"]',
      'input[name="file"]',
      'input[style*="hidden"]',
    ];

    let fileInput = null;
    for (const selector of fileSelectors) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ ファイル入力発見: ${selector}`);
        break;
      }
      console.log(`⚠️  ファイル入力なし: ${selector}`);
      await randomDelay(1000, 2000); // 待機してから次を試す
    }

    if (!fileInput) {
      // 最終手段: JavaScript evaluate
      fileInput = await page.evaluateHandle(() => document.querySelector('input[type="file"]'));
      if (!fileInput) {
        await page.screenshot({ path: DEBUG_DIR + '/error-no-file-input.png' });
        console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-no-file-input.png');
        throw new Error('ファイル入力なし');
      }
      console.log('✅ ファイル入力発見: evaluate');
    }

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/03-before-upload.png');
    await page.screenshot({ path: DEBUG_DIR + '/03-before-upload.png' });

    await fileInput.uploadFile(imagePath);
    console.log('✅ ファイルアップロード完了');

    await randomDelay(4000, 6000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/04-after-upload.png');
    await page.screenshot({ path: DEBUG_DIR + '/04-after-upload.png' });

    // キャプション入力
    console.log('📝 Step 4: Enter caption');
    const textArea = await page.$('div[contenteditable="true"], textarea[placeholder*="thread"]');
    if (textArea) {
      console.log('✅ キャプション入力欄発見');
      
      console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/05-before-caption.png');
      await page.screenshot({ path: DEBUG_DIR + '/05-before-caption.png' });
      
      await textArea.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ キャプション入力完了');
    } else {
      console.log('⚠️  キャプション入力欄なし');
    }

    await randomDelay(2000, 4000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/06-after-caption.png');
    await page.screenshot({ path: DEBUG_DIR + '/06-after-caption.png' });

    // 投稿ボタンをXPathで検索
    console.log('📤 Step 5: Click Post button');
    const postButtons = await page.$x("//div[@role='button' and contains(., 'Post')] | //button[contains(., 'Post')]");
    if (postButtons.length === 0) {
      await page.screenshot({ path: DEBUG_DIR + '/error-no-post-button.png' });
      console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-no-post-button.png');
      throw new Error('投稿ボタンが見つかりません');
    }
    
    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/07-before-post.png');
    await page.screenshot({ path: DEBUG_DIR + '/07-before-post.png' });
    
    await postButtons[0].click();
    console.log('✅ 投稿完了待機中...');

    await randomDelay(10000, 15000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/08-after-post.png');
    await page.screenshot({ path: DEBUG_DIR + '/08-after-post.png' });

    await logPost('threads');
    console.log('🎉 Threads投稿完了（スクリーンショット強化版）！');

  } catch (error) {
    console.error('❌ エラー発生:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
