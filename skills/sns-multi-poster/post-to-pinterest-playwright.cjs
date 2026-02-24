#!/usr/bin/env node
/**
 * Pinterest 投稿スクリプト - Playwright Cookie認証版
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
  console.error('使い方: node post-to-pinterest-playwright.cjs <image_path> <caption>');
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/pinterest.json');
const PROFILE_DIR = path.join(__dirname, 'browser-profiles/pinterest-profile');

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
  console.log('📌 Pinterest 投稿開始 (Playwright Cookie認証版)');

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
        value: decodeURIComponent(c.value),
        domain: c.domain || '.pinterest.com',
        path: c.path || '/',
        expires: c.expirationDate ? c.expirationDate : -1,
        httpOnly: c.httpOnly || false,
        secure: c.secure !== false,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      }));
      await page.context().addCookies(playwrightCookies);
      console.log('✅ Cookie読み込み完了');
    }

    await randomDelay(2000, 5000);

    // Pinterestホームページへ移動
    await page.goto('https://www.pinterest.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    console.log('✅ Pinterest読み込み完了');

    await randomDelay(5000, 8000);

    // 新規Pin作成ボタンを探す（複数の可能性を考慮）
    const createButton = await page.locator('[aria-label="Create Pin"], button:has-text("Create")').first();
    if (!await createButton.isVisible({ timeout: 5000 })) {
      throw new Error('Create Pinボタンが見つかりません');
    }
    await createButton.click();
    console.log('✅ Create Pinボタンクリック');

    await randomDelay(2000, 4000);

    // ファイルアップロード
    const fileInput = await page.locator('input[type="file"]').first();
    if (!await fileInput.isVisible({ timeout: 5000 })) {
      throw new Error('ファイル入力が見つかりません');
    }
    await fileInput.setInputFiles(imagePath);
    console.log('✅ ファイルアップロード完了');

    await randomDelay(4000, 6000);

    // タイトル入力
    const titleInput = await page.locator('input[placeholder*="title"], textarea[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 3000 })) {
      await titleInput.click();
      await randomDelay(500, 1000);
      await titleInput.fill(caption.slice(0, 100)); // タイトルは100文字まで
      console.log('✅ タイトル入力完了');
      await randomDelay(1000, 2000);
    }

    // 説明入力
    const descInput = await page.locator('textarea[placeholder*="description"], div[contenteditable="true"][aria-label*="description"]').first();
    if (await descInput.isVisible({ timeout: 3000 })) {
      await descInput.click();
      await randomDelay(500, 1000);
      await descInput.fill(caption);
      console.log('✅ 説明入力完了');
      await randomDelay(1000, 2000);
    }

    // Publishボタンをクリック
    const publishButton = await page.locator('button:has-text("Publish"), button[data-test-id="board-dropdown-save-button"]').first();
    if (!await publishButton.isVisible({ timeout: 5000 })) {
      throw new Error('Publishボタンが見つかりません');
    }
    await publishButton.click();
    console.log('✅ Publishボタンクリック');

    await randomDelay(5000, 8000);

    // 投稿完了確認（URLにpin/が含まれるかチェック）
    const currentUrl = page.url();
    if (currentUrl.includes('/pin/') || currentUrl.includes('created')) {
      console.log('✅ Pinterest投稿成功');
      await logPost('pinterest');
    } else {
      throw new Error('投稿完了を確認できませんでした');
    }

  } catch (error) {
    console.error('❌ Pinterest投稿エラー:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
