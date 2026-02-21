#!/usr/bin/env node
/**
 * Pinterest 投稿スクリプト v2 - BAN対策版
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
  console.error('使い方: node post-to-pinterest-v2-anti-ban.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/pinterest.json');

async function main() {
  console.log('🛡️  BAN対策チェック (Pinterest)...');

  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Pinterest投稿スキップ');
    return;
  }

  if (!isAllowedPostingTime()) {
    console.error('❌ 投稿禁止時間帯です');
    process.exit(1);
  }

  if (!(await checkRateLimit('pinterest'))) {
    console.error('❌ レート制限超過（Pinterest: 6投稿/時間、50投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('📌 Pinterest 投稿開始 (v2 - BAN対策版)');

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
      domain: c.domain || '.pinterest.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'None'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    await randomDelay(2000, 5000);

    await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
    console.log('✅ Pinterest読み込み完了');

    await randomDelay(5000, 8000);

    // 新規Pin作成ボタン
    await page.click('[aria-label="Create Pin"], button:has-text("Create")');
    await randomDelay(2000, 4000);

    // ファイルアップロード
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('ファイル入力なし');
    await fileInput.uploadFile(imagePath);
    console.log('✅ ファイルアップロード完了');

    await randomDelay(4000, 6000);

    // タイトル・説明入力
    const titleInput = await page.$('input[placeholder*="title"], textarea[placeholder*="title"]');
    if (titleInput) {
      await titleInput.click();
      await randomDelay(500, 1000);
      const title = caption.substring(0, 100);
      for (const char of title) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
    }

    const descInput = await page.$('textarea[placeholder*="description"], div[contenteditable="true"]');
    if (descInput) {
      await descInput.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ タイトル・説明入力完了');
    }

    await randomDelay(2000, 4000);

    // 投稿
    await page.click('button:has-text("Publish"), button:has-text("Save")');
    console.log('✅ 投稿完了待機中...');

    await randomDelay(10000, 15000);

    await logPost('pinterest');
    console.log('🎉 Pinterest投稿完了（BAN対策版）！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
