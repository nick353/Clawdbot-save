#!/usr/bin/env node
/**
 * Facebook 投稿スクリプト v2 - BAN対策版
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
  console.error('使い方: node post-to-facebook-v2-anti-ban.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/facebook.json');

async function main() {
  console.log('🛡️  BAN対策チェック (Facebook)...');

  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Facebook投稿スキップ');
    return;
  }

  if (!isAllowedPostingTime()) {
    console.error('❌ 投稿禁止時間帯です');
    process.exit(1);
  }

  if (!(await checkRateLimit('facebook'))) {
    console.error('❌ レート制限超過（Facebook: 5投稿/時間、30投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('📘 Facebook 投稿開始 (v2 - BAN対策版)');

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
      domain: c.domain || '.facebook.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'None'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    await randomDelay(2000, 5000);

    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('✅ Facebook読み込み完了');

    await randomDelay(5000, 8000);

    // 新規投稿ボタン
    await page.click('[aria-label*="Create"], [role="button"]:has-text("What\'s on your mind")');
    await randomDelay(2000, 4000);

    // ファイルアップロード
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) throw new Error('ファイル入力なし');
    await fileInput.uploadFile(imagePath);
    console.log('✅ ファイルアップロード完了');

    await randomDelay(4000, 6000);

    // キャプション入力
    const textBox = await page.$('div[contenteditable="true"][role="textbox"]');
    if (textBox) {
      await textBox.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ キャプション入力完了');
    }

    await randomDelay(2000, 4000);

    // 投稿
    await page.click('[aria-label="Post"], button:has-text("Post")');
    console.log('✅ 投稿完了待機中...');

    await randomDelay(10000, 15000);

    await logPost('facebook');
    console.log('🎉 Facebook投稿完了（BAN対策版）！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
