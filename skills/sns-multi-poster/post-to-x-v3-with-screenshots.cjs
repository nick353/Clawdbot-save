#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト v3 - スクリーンショット強化版
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
  console.error('使い方: node post-to-x-v3-with-screenshots.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/x.json');
const DEBUG_DIR = '/tmp/x-visual-debug';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function main() {
  console.log('🛡️  BAN対策チェック (X)...');

  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: X投稿スキップ');
    console.log('📷 画像:', imagePath);
    console.log('📝 キャプション:', caption);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  // 時間帯制限を一時的に無効化（2026-02-24）
  // if (!isAllowedPostingTime()) {
  //   console.error('❌ 投稿禁止時間帯です');
  //   process.exit(1);
  // }

  if (!(await checkRateLimit('x'))) {
    console.error('❌ レート制限超過（X: 10投稿/時間、100投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('🐦 X 投稿開始 (v3 - スクリーンショット強化版)');

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

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.x.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    await randomDelay(2000, 5000);

    console.log('🔄 Step 1: Navigate to X compose page');
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ X読み込み完了');

    // 追加待機（ページが完全に表示されるまで）
    await randomDelay(10000, 15000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/01-page-loaded.png');
    await page.screenshot({ path: DEBUG_DIR + '/01-page-loaded.png' });

    // ツイート入力（複数セレクタを試す）
    console.log('🔄 Step 2: Find tweet input box');
    const tweetBoxSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="What is happening"]',
      'textarea[placeholder*="happening" i]'
    ];

    let tweetBox = null;
    for (const selector of tweetBoxSelectors) {
      tweetBox = await page.$(selector);
      if (tweetBox) {
        console.log(`✅ ツイート入力欄を発見: ${selector}`);
        break;
      }
      console.log(`⚠️  ツイート入力欄なし: ${selector}`);
    }

    if (!tweetBox) {
      await page.screenshot({ path: DEBUG_DIR + '/error-no-input.png' });
      console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-no-input.png');
      throw new Error('ツイート入力欄が見つかりません');
    }

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/02-before-input.png');
    await page.screenshot({ path: DEBUG_DIR + '/02-before-input.png' });

    console.log('📝 Step 3: Enter tweet text');
    await tweetBox.click();
    await randomDelay(500, 1000);

    for (const char of caption) {
      await page.keyboard.type(char);
      await randomDelay(50, 150);
    }
    console.log('✅ ツイート入力完了');

    await randomDelay(1000, 2000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/03-after-input.png');
    await page.screenshot({ path: DEBUG_DIR + '/03-after-input.png' });

    // 画像アップロード
    console.log('📷 Step 4: Upload image');
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) {
      await page.screenshot({ path: DEBUG_DIR + '/error-no-file-input.png' });
      console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-no-file-input.png');
      throw new Error('ファイル入力なし');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');

    await randomDelay(3000, 5000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/04-after-upload.png');
    await page.screenshot({ path: DEBUG_DIR + '/04-after-upload.png' });

    // ツイートボタン（複数セレクタ + XPath）
    console.log('📤 Step 5: Click Post button');
    const tweetButtonSelectors = [
      'button[data-testid="tweetButton"]',
      'button[data-testid="tweetButtonInline"]',
      'div[data-testid="tweetButton"]',
      'div[role="button"][data-testid="tweetButton"]',
      'button[role="button"][data-testid="tweetButton"]'
    ];

    let tweetButtonClicked = false;
    for (const selector of tweetButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        
        console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/05-before-post.png');
        await page.screenshot({ path: DEBUG_DIR + '/05-before-post.png' });
        
        await page.click(selector);
        tweetButtonClicked = true;
        console.log(`✅ 投稿ボタンをクリック: ${selector}`);
        break;
      } catch (e) {
        console.log(`⚠️  投稿ボタン失敗: ${selector}`);
      }
    }

    // XPath フォールバック（"Post" または "Tweet" テキストを含むボタン）
    if (!tweetButtonClicked) {
      console.log('🔍 XPath でボタン検索...');
      const xpathButtons = await page.$x("//button[contains(., 'Post')] | //button[contains(., 'Tweet')] | //div[@role='button' and contains(., 'Post')]");
      if (xpathButtons.length > 0) {
        console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/05-before-post-xpath.png');
        await page.screenshot({ path: DEBUG_DIR + '/05-before-post-xpath.png' });
        
        await xpathButtons[0].click();
        tweetButtonClicked = true;
        console.log('✅ 投稿ボタンをクリック: XPath');
      }
    }

    if (!tweetButtonClicked) {
      await page.screenshot({ path: DEBUG_DIR + '/error-no-post-button.png' });
      console.log('📸 エラースクリーンショット: ' + DEBUG_DIR + '/error-no-post-button.png');
      throw new Error('投稿ボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');

    await randomDelay(8000, 12000);

    console.log('📸 スクリーンショット: ' + DEBUG_DIR + '/06-after-post.png');
    await page.screenshot({ path: DEBUG_DIR + '/06-after-post.png' });

    await logPost('x');
    console.log('🎉 X投稿完了（スクリーンショット強化版）！');

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
