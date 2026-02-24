#!/usr/bin/env node

/**
 * Threads 投稿スクリプト（最終版）
 * 
 * 使い方:
 *   DRY_RUN=true node post-to-threads-final.cjs <画像パス> "キャプション"
 *   node post-to-threads-final.cjs <画像パス> "キャプション"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const [, , imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('使い方: node post-to-threads-final.cjs <画像パス> "キャプション"');
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

  console.log('🌐 Threads 投稿スクリプト（最終版）');
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

    // Threads ホームに移動
    console.log('🌐 Threads にアクセス...');
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(3000);
    console.log('✅ ページ読み込み完了');

    // "What's new?" ボタンをクリック
    console.log('🔍 "What\'s new?" ボタンを探索...');
    const whatsNewButton = await page.$('div[contenteditable="true"][aria-label="Start a thread..."]');
    if (!whatsNewButton) {
      // 代替セレクタ
      const altWhatsNewButton = await page.$('textarea[placeholder="What\'s new?"]');
      if (altWhatsNewButton) {
        await altWhatsNewButton.click();
        console.log('✅ "What\'s new?" をクリック（textarea）');
      } else {
        console.error('❌ "What\'s new?" ボタンが見つかりません');
        await page.screenshot({ path: '/tmp/threads-whatsnew-not-found.png' });
        process.exit(1);
      }
    } else {
      await whatsNewButton.click();
      console.log('✅ "What\'s new?" をクリック');
    }

    await page.waitForTimeout(2000);

    // キャプション入力
    console.log('📝 キャプションを入力...');
    await page.keyboard.type(caption, { delay: 50 });
    console.log('✅ キャプションを入力');

    await page.waitForTimeout(1000);

    // 画像添付ボタンをクリック
    console.log('🔍 画像添付ボタンを探索...');
    const attachButton = await page.$('svg[aria-label="Attach media"]');
    if (!attachButton) {
      console.error('❌ 画像添付ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/threads-attach-not-found.png' });
      process.exit(1);
    }

    await attachButton.click();
    console.log('✅ 画像添付ボタンをクリック');

    await page.waitForTimeout(1000);

    // ファイルインプットを探す
    console.log('🔍 ファイルインプットを探索...');
    const fileInput = await page.$('input[type="file"][accept="image/*,video/*"]');
    if (!fileInput) {
      console.error('❌ ファイルインプットが見つかりません');
      await page.screenshot({ path: '/tmp/threads-file-input-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      await page.screenshot({ path: '/tmp/threads-dry-run.png' });
      console.log('📸 スクリーンショット: /tmp/threads-dry-run.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Post" ボタンをクリック
    console.log('⏳ 投稿準備完了、投稿しています...');
    const postButton = await page.$x('//button[contains(text(), "Post")]');
    if (postButton.length === 0) {
      console.error('❌ "Post" ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/threads-post-not-found.png' });
      process.exit(1);
    }

    await postButton[0].click();
    console.log('✅ "Post" ボタンをクリック');

    // 投稿完了を待機
    await page.waitForTimeout(5000);

    console.log('==================================================');
    console.log('✅ Threads 投稿完了');

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
