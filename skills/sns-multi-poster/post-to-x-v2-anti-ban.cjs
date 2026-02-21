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
    return;
  }

  if (!isAllowedPostingTime()) {
    console.error('❌ 投稿禁止時間帯です');
    process.exit(1);
  }

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

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);

    await randomDelay(2000, 5000);

    await page.goto('https://x.com/compose/post', { waitUntil: 'networkidle2', timeout: 120000 });
    console.log('✅ X読み込み完了');

    await randomDelay(3000, 6000);

    // ツイート入力
    const tweetBox = await page.$('div[contenteditable="true"][role="textbox"]');
    if (!tweetBox) throw new Error('ツイート入力欄が見つかりません');

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

    // ツイートボタン
    await page.click('button[data-testid="tweetButton"], button:has-text("Post")');
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
