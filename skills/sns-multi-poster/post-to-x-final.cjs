#!/usr/bin/env node

/**
 * X (Twitter) 投稿スクリプト（最終版）
 * 
 * 使い方:
 *   DRY_RUN=true node post-to-x-final.cjs <画像パス> "キャプション"
 *   node post-to-x-final.cjs <画像パス> "キャプション"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/x.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const [, , imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('使い方: node post-to-x-final.cjs <画像パス> "キャプション"');
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

  console.log('🌐 X (Twitter) 投稿スクリプト（最終版）');
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

    // X (Twitter) ホームに移動
    console.log('🌐 X にアクセス...');
    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(3000);
    console.log('✅ ページ読み込み完了');

    // ツイート入力欄を探す
    console.log('🔍 ツイート入力欄を探索...');
    const tweetBox = await page.$('div[data-testid="tweetTextarea_0"]');
    if (!tweetBox) {
      console.error('❌ ツイート入力欄が見つかりません');
      await page.screenshot({ path: '/tmp/x-tweetbox-not-found.png' });
      process.exit(1);
    }

    await tweetBox.click();
    console.log('✅ ツイート入力欄をクリック');

    await page.waitForTimeout(1000);

    // キャプション入力
    console.log('📝 キャプションを入力...');
    await page.keyboard.type(caption, { delay: 50 });
    console.log('✅ キャプションを入力');

    await page.waitForTimeout(1000);

    // 画像添付ボタンをクリック
    console.log('🔍 画像添付ボタンを探索...');
    const attachButton = await page.$('input[data-testid="fileInput"]');
    if (!attachButton) {
      console.error('❌ 画像添付ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/x-attach-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await attachButton.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      await page.screenshot({ path: '/tmp/x-dry-run.png' });
      console.log('📸 スクリーンショット: /tmp/x-dry-run.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Post" ボタンをクリック
    console.log('⏳ 投稿準備完了、投稿しています...');
    const postButton = await page.$('button[data-testid="tweetButtonInline"]');
    if (!postButton) {
      console.error('❌ "Post" ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/x-post-not-found.png' });
      process.exit(1);
    }

    await postButton.click();
    console.log('✅ "Post" ボタンをクリック');

    // 投稿完了を待機
    await page.waitForTimeout(5000);

    console.log('==================================================');
    console.log('✅ X (Twitter) 投稿完了');

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
