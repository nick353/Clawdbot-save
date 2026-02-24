#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト v2 - BAN対策版
 * Level 1 + Level 2 統合
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
  console.error('使い方: node post-to-x-v2-anti-ban.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/x.json');

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
  console.log('🐦 X 投稿開始 (v2 - BAN対策版)');

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

    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ X読み込み完了');

    // 追加待機（ページが完全に表示されるまで）
    await randomDelay(10000, 15000);

    // スクリーンショット（デバッグ用）
    await page.screenshot({ path: '/tmp/x-debug-before-search.png' });
    console.log('📸 スクリーンショット保存: /tmp/x-debug-before-search.png');

    // ツイート入力（複数セレクタを試す）
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
      await page.screenshot({ path: '/tmp/x-debug-no-input.png' });
      console.log('📸 エラースクリーンショット: /tmp/x-debug-no-input.png');
      throw new Error('ツイート入力欄が見つかりません');
    }

    await tweetBox.click();
    await randomDelay(500, 1000);

    for (const char of caption) {
      await page.keyboard.type(char);
      await randomDelay(50, 150);
    }
    console.log('✅ ツイート入力完了');

    await randomDelay(1000, 2000);

    // 画像アップロード
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) throw new Error('ファイル入力なし');
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');

    await randomDelay(3000, 5000);

    // ツイートボタン（複数セレクタ + XPath）
    await page.screenshot({ path: '/tmp/x-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/x-before-post.png');

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
        await xpathButtons[0].click();
        tweetButtonClicked = true;
        console.log('✅ 投稿ボタンをクリック: XPath');
      }
    }

    if (!tweetButtonClicked) {
      await page.screenshot({ path: '/tmp/x-no-post-button.png' });
      console.log('📸 エラースクリーンショット: /tmp/x-no-post-button.png');
      throw new Error('投稿ボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');

    await randomDelay(8000, 12000);

    await logPost('x');
    console.log('🎉 X投稿完了（BAN対策版）！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
