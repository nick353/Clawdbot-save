#!/usr/bin/env node
/**
 * LinkedIn 投稿スクリプト - Cookie認証版 + Stealth
 * 
 * Usage: node post-to-linkedin.cjs <image_path> <caption>
 * 
 * 事前準備:
 *   1. ブラウザでLinkedInにログインし、Cookieを cookies/linkedin.json にエクスポート
 *   2. 画像パスとキャプションを引数で渡す
 * 
 * Cookie取得方法 (Chrome拡張 "Cookie Editor" 等):
 *   https://www.linkedin.com にアクセス → 拡張機能でCookieをエクスポート → linkedin.json に保存
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-linkedin.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/linkedin.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToLinkedIn(imagePath, caption) {
  console.log('💼 LinkedIn に投稿開始...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`📷 画像: ${imagePath}`);

  if (!fs.existsSync(COOKIES_PATH)) {
    throw new Error(
      `❌ Cookieファイルが見つかりません: ${COOKIES_PATH}\n` +
      `  → ブラウザでLinkedInにログインし、Cookieを "${COOKIES_PATH}" に保存してください`
    );
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  try {
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    // Cookie設定
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');

    // LinkedInホームにアクセス
    console.log('📂 LinkedIn にアクセス中...');
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await sleep(3000);

    // ログイン確認
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/uas/login') || currentUrl.includes('/checkpoint')) {
      await page.screenshot({ path: '/tmp/linkedin-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります\nスクリーンショット: /tmp/linkedin-login-error.png');
    }

    console.log('✅ ログイン確認完了');

    // 「投稿を開始」ボタンをクリック（ホームフィードの上部）
    console.log('📝 投稿ダイアログを開く...');
    await page.waitForSelector(
      '[data-test-id="share-box-feed-entry__trigger"], ' +
      '.share-box-feed-entry__trigger, ' +
      'button.share-box-feed-entry__trigger',
      { timeout: 15000 }
    );
    await page.click(
      '[data-test-id="share-box-feed-entry__trigger"], ' +
      '.share-box-feed-entry__trigger'
    );
    await sleep(2000);

    // 投稿ダイアログが開くのを待つ
    await page.waitForSelector('.share-creation-state__content', { timeout: 15000 }).catch(() => {});
    await sleep(1000);

    // テキスト入力エリアをクリック
    console.log('📝 テキスト入力中...');
    const textSelector = '.ql-editor, [data-placeholder="何を考えていますか？"], [aria-label*="投稿"]';
    await page.waitForSelector(textSelector, { timeout: 15000 });
    await page.click(textSelector);
    await sleep(500);
    await page.type(textSelector, caption, { delay: 30 });
    console.log('✅ テキスト入力完了');

    // 画像アップロードボタンをクリック
    console.log('📷 画像アップロード中...');
    // LinkedIn の「写真を追加」ボタン
    try {
      await page.click('[aria-label*="写真"], [aria-label*="photo"], [data-control-name="image"]');
      await sleep(1000);
    } catch (e) {
      // ボタンが見つからない場合はファイル入力を直接探す
    }

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      await page.screenshot({ path: '/tmp/linkedin-no-file-input.png' });
      throw new Error('ファイル入力が見つかりません。スクリーンショット: /tmp/linkedin-no-file-input.png');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード開始');
    await sleep(5000);

    await page.screenshot({ path: '/tmp/linkedin-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/linkedin-before-post.png');

    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      await browser.close();
      return { success: true, dryRun: true };
    }

    // 投稿ボタンをクリック
    console.log('📤 投稿ボタンをクリック...');
    const postButtonSelector =
      '[data-control-name="share.post"], ' +
      'button.share-actions__primary-action, ' +
      '[data-test-id="share-form__share-btn"]';
    await page.waitForSelector(postButtonSelector, { timeout: 15000 });
    await page.click(postButtonSelector);
    await sleep(5000);

    // 投稿完了確認
    await page.screenshot({ path: '/tmp/linkedin-after-post.png' });
    const finalUrl = page.url();
    console.log('✅ 投稿完了！');
    console.log(`📸 投稿後スクリーンショット: /tmp/linkedin-after-post.png`);
    console.log(`🔗 現在のURL: ${finalUrl}`);

    await browser.close();
    return { success: true, url: finalUrl };

  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    try { await page.screenshot({ path: '/tmp/linkedin-error.png' }); } catch (_) {}
    await browser.close();
    throw error;
  }
}

postToLinkedIn(imagePath, caption)
  .then(result => {
    if (result.dryRun) {
      console.log('✅ DRY RUN 完了');
    } else {
      console.log('🎉 LinkedInへの投稿成功！');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 投稿失敗:', err.message);
    process.exit(1);
  });
