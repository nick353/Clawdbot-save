#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト - Playwright Cookie認証版
 * Facebook/Instagram/Threadsと同じPlaywright実装
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const {
  checkRateLimit,
  logPost,
  isAllowedPostingTime,
  randomDelay,
  getRandomUserAgent,
  config,
} = require('./lib/anti-ban-helpers.js');

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-x-playwright.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/x.json');
const PROFILE_DIR = path.join(__dirname, 'browser-profiles/x-profile');

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
  console.log('🐦 X 投稿開始 (Playwright Cookie認証版)');

  // プロファイルディレクトリ作成
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const userAgent = getRandomUserAgent();
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    args: config.browserArgs,
    userAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    // Cookie読み込み
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      const playwrightCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.x.com',
        path: c.path || '/',
        expires: c.expirationDate ? c.expirationDate : -1,
        httpOnly: c.httpOnly || false,
        secure: c.secure || false,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      }));
      await page.context().addCookies(playwrightCookies);
      console.log('✅ Cookie読み込み完了');
    }

    await randomDelay(2000, 5000);

    // X投稿ページへ移動
    await page.goto('https://x.com/compose/post', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log('✅ X読み込み完了');

    await randomDelay(3000, 6000);

    // ツイート入力欄を探す
    const tweetBox = await page.locator('div[contenteditable="true"][role="textbox"]').first();
    if (!await tweetBox.isVisible()) {
      throw new Error('ツイート入力欄が見つかりません');
    }

    await tweetBox.click();
    await randomDelay(500, 1000);

    // キャプションを1文字ずつ入力（人間らしく）
    for (const char of caption) {
      await page.keyboard.type(char);
      await randomDelay(50, 150);
    }
    console.log('✅ ツイート入力完了');

    await randomDelay(1000, 2000);

    // 画像アップロード
    const fileInput = await page.locator('input[type="file"][accept*="image"]').first();
    if (!await fileInput.isVisible()) {
      throw new Error('ファイル入力が見つかりません');
    }
    await fileInput.setInputFiles(imagePath);
    console.log('✅ 画像アップロード完了');

    await randomDelay(3000, 5000);

    // ツイートボタンをクリック
    const tweetButton = await page.locator('button[data-testid="tweetButton"], button:has-text("Post")').first();
    if (!await tweetButton.isVisible()) {
      throw new Error('ツイートボタンが見つかりません');
    }
    await tweetButton.click();
    console.log('✅ ツイートボタンクリック');

    await randomDelay(5000, 8000);

    // 投稿完了確認
    const currentUrl = page.url();
    if (currentUrl.includes('/status/') || currentUrl === 'https://x.com/home') {
      console.log('✅ X投稿成功');
      await logPost('x');
    } else {
      throw new Error('投稿完了を確認できませんでした');
    }

  } catch (error) {
    console.error('❌ X投稿エラー:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
