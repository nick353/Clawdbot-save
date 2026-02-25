#!/usr/bin/env node
/**
 * Threads Vision API テストスクリプト
 * "Create"ボタンと"Post"ボタンの検出テスト
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const visionHelper = require('./vision-helper-claude.cjs');

puppeteer.use(StealthPlugin());

const {
  randomDelay,
  getRandomUserAgent,
  bypassChromeDetection,
  config,
} = require('./lib/anti-ban-helpers.js');

const COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');
const DEBUG_DIR = '/tmp/threads-vision-test';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

async function main() {
  console.log('🧪 Threads Vision API テスト開始\n');

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
    console.log('🔐 Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => ({
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
    console.log(`✅ Cookie設定完了 (${cookies.length}件)\n`);

    await randomDelay(2000, 5000);

    // Threadsページ移動
    console.log('🌐 Threadsページ移動...');
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('✅ ページ読み込み完了\n');

    await randomDelay(8000, 12000);

    // ステップ1: "Create"ボタン検出
    console.log('━━━ テスト1: "Create" ボタン検出 ━━━');
    const createScreenshot = path.join(DEBUG_DIR, '01-create-button.png');
    await page.screenshot({ path: createScreenshot });
    console.log(`📸 スクリーンショット: ${createScreenshot}\n`);

    const createResult = await visionHelper.detectUIElement(createScreenshot, 'Create', {
      debug: true,
      maxRetries: 3
    });

    if (createResult) {
      console.log(`\n✅ "Create" ボタン検出成功！`);
      console.log(`   座標: (${createResult.x}, ${createResult.y})`);
      console.log(`   確信度: ${(createResult.confidence * 100).toFixed(1)}%`);
      console.log(`   検出テキスト: "${createResult.text}"\n`);

      // デバッグオーバーレイ作成
      const createOverlay = path.join(DEBUG_DIR, '01-create-overlay.png');
      await visionHelper.drawDebugOverlay(createScreenshot, [createResult], createOverlay);

      // クリックしてみる
      console.log('🎯 "Create"ボタンをクリック...');
      await page.mouse.click(createResult.x, createResult.y);
      await randomDelay(3000, 5000);

      // クリック後のスクリーンショット
      const afterCreate = path.join(DEBUG_DIR, '02-after-create.png');
      await page.screenshot({ path: afterCreate });
      console.log(`📸 クリック後スクリーンショット: ${afterCreate}\n`);

      // ステップ2: "Post"ボタン検出（投稿画面が開いているか確認）
      console.log('━━━ テスト2: "Post" ボタン検出 ━━━');
      await randomDelay(2000, 4000);

      const postScreenshot = path.join(DEBUG_DIR, '03-post-button.png');
      await page.screenshot({ path: postScreenshot });
      console.log(`📸 スクリーンショット: ${postScreenshot}\n`);

      const postResult = await visionHelper.detectUIElement(postScreenshot, 'Post', {
        debug: true,
        maxRetries: 3
      });

      if (postResult) {
        console.log(`\n✅ "Post" ボタン検出成功！`);
        console.log(`   座標: (${postResult.x}, ${postResult.y})`);
        console.log(`   確信度: ${(postResult.confidence * 100).toFixed(1)}%`);
        console.log(`   検出テキスト: "${postResult.text}"\n`);

        // デバッグオーバーレイ作成
        const postOverlay = path.join(DEBUG_DIR, '03-post-overlay.png');
        await visionHelper.drawDebugOverlay(postScreenshot, [postResult], postOverlay);
      } else {
        console.log(`\n❌ "Post" ボタンが見つかりませんでした`);
      }
    } else {
      console.log(`\n❌ "Create" ボタンが見つかりませんでした`);
    }

    console.log('\n━━━ テスト完了 ━━━');
    console.log(`📁 デバッグファイル: ${DEBUG_DIR}`);

  } catch (error) {
    console.error('❌ エラー発生:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

main().then(() => {
  console.log('\n✅ テスト正常終了');
  process.exit(0);
}).catch(e => {
  console.error('\n❌ テスト失敗:', e.message);
  process.exit(1);
});
