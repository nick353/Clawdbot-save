#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト - Cookie認証版 + Stealth
 * 
 * Usage: node post-to-x.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const imagePath = process.argv[2];
const caption = process.argv[3];

if (!imagePath || !caption) {
  console.error('使い方: node post-to-x.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/x.json');

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: X投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToX(imagePath, caption) {
  console.log('🐦 X (Twitter) に投稿開始...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`📷 画像: ${imagePath}`);

  if (!fs.existsSync(COOKIES_PATH)) {
    throw new Error(`Cookieファイルが見つかりません: ${COOKIES_PATH}`);
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

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });
    
    // Cookie設定
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');
    
    // X.comにアクセス
    console.log('📂 X.comにアクセス中...');
    await page.goto('https://x.com/compose/post', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await sleep(3000);
    
    // ログイン確認
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/i/flow')) {
      await page.screenshot({ path: '/tmp/x-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    
    console.log('✅ ログイン確認完了');
    
    // テキスト入力
    console.log('📝 テキスト入力中...');
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
    await page.click('[data-testid="tweetTextarea_0"]');
    await sleep(500);
    await page.type('[data-testid="tweetTextarea_0"]', caption, { delay: 30 });
    console.log('✅ テキスト入力完了');
    
    // 画像アップロード
    console.log('📷 画像アップロード中...');
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    
    if (!fileInput) {
      // メディアボタンをクリックしてファイル入力を探す
      try {
        await page.click('[data-testid="attachments"]');
        await sleep(1000);
      } catch(e) {}
      const fileInput2 = await page.$('input[type="file"]');
      if (!fileInput2) {
        await page.screenshot({ path: '/tmp/x-no-file-input.png' });
        throw new Error('ファイル入力が見つかりません');
      }
      await fileInput2.uploadFile(imagePath);
    } else {
      await fileInput.uploadFile(imagePath);
    }
    
    console.log('✅ 画像アップロード開始');
    await sleep(5000);
    
    // アップロード完了確認（プレビューが表示されるまで待つ）
    try {
      await page.waitForSelector('[data-testid="attachments"]', { timeout: 30000 });
    } catch(e) { /* プレビュー確認スキップ */ }

    await page.screenshot({ path: '/tmp/x-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/x-before-post.png');
    
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      return { success: true, dryRun: true };
    }
    
    // 投稿ボタン
    console.log('📤 投稿ボタンをクリック...');
    await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 15000 });
    await page.click('[data-testid="tweetButton"]');
    await sleep(5000);
    
    await page.screenshot({ path: '/tmp/x-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/x-after-post.png');
    console.log('✅ X投稿完了！');
    
    return { success: true, platform: 'X', screenshot: '/tmp/x-after-post.png' };
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/x-error.png' }); } catch(e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// リトライロジック
async function postWithRetry(maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await postToX(imagePath, caption);
    } catch (err) {
      if (i < maxRetries) {
        console.log(`⚠️  リトライ ${i + 1}/${maxRetries}... (30秒待機)`);
        await sleep(30000);
      } else {
        throw err;
      }
    }
  }
}

postWithRetry()
  .then(result => {
    console.log('\n✅ 投稿成功！');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 投稿失敗:', error.message);
    process.exit(1);
  });
