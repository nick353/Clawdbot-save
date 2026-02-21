#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト - Cookie認証版 + Stealth（個人アカウント用）
 *
 * Usage: node post-to-x-personal.cjs "投稿テキスト" [メディアパス（画像/動画）]
 *
 * 対応メディア: jpg, png, gif, webp, mp4, mov, avi
 * Cookie: /root/clawd/skills/sns-curator/cookies/x-personal.json
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const postText = process.argv[2];
const mediaPath = process.argv[3] || null;  // 画像または動画

// 動画ファイルかどうか判定
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
const isVideo = mediaPath ? VIDEO_EXTS.includes(path.extname(mediaPath).toLowerCase()) : false;

if (!postText) {
  console.error('使い方: node post-to-x-personal.cjs "投稿テキスト" [画像/動画パス]');
  process.exit(1);
}

if (mediaPath && !fs.existsSync(mediaPath)) {
  console.error(`❌ メディアファイルが見つかりません: ${mediaPath}`);
  process.exit(1);
}

// ⚠️ 個人アカウント用Cookieパス
const COOKIES_PATH = path.join(__dirname, 'cookies/x-personal.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Cookieファイルの検証
 * 空配列 [] や存在しない場合はスキップメッセージを出して終了
 */
function validateCookies() {
  if (!fs.existsSync(COOKIES_PATH)) {
    console.error('⚠️  X個人アカウントのCookieファイルが見つかりません。');
    console.error(`   配置先: ${COOKIES_PATH}`);
    console.error('   Chrome拡張 "Cookie Editor" でx.comのCookieをエクスポートして配置してください。');
    console.error('   詳細: SKILL.md の "Cookie取得方法" を参照');
    return false;
  }

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
  } catch (e) {
    console.error(`❌ Cookieファイルのパースに失敗: ${e.message}`);
    return false;
  }

  if (!Array.isArray(cookies) || cookies.length === 0) {
    console.error('⚠️  X個人アカウントのCookieが設定されていません（空の配列）。');
    console.error(`   配置先: ${COOKIES_PATH}`);
    console.error('   Chrome拡張 "Cookie Editor" でx.comのCookieをエクスポートして配置してください。');
    console.error('   詳細: SKILL.md の "Cookie取得方法" を参照');
    return false;
  }

  return cookies;
}

async function postToX(text, imgPath) {
  console.log('🐦 X (Twitter) 個人アカウントに投稿開始...');
  console.log(`📝 テキスト: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
  if (imgPath) console.log(`📷 画像: ${imgPath}`);

  const cookies = validateCookies();
  if (!cookies) {
    process.exit(0); // エラーで止めない（スキップ）
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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    // Cookie設定
    await page.setCookie(...cookies);
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
      await page.screenshot({ path: '/tmp/x-personal-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');

    // テキスト入力
    console.log('📝 テキスト入力中...');
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
    await page.click('[data-testid="tweetTextarea_0"]');
    await sleep(500);
    await page.type('[data-testid="tweetTextarea_0"]', text, { delay: 20 });
    console.log('✅ テキスト入力完了');

    // メディアアップロード（画像/動画）
    if (imgPath) {
      const isVideoFile = ['.mp4', '.mov', '.avi', '.webm', '.mkv']
        .includes(require('path').extname(imgPath).toLowerCase());
      console.log(isVideoFile ? '🎬 動画アップロード中...' : '📷 画像アップロード中...');

      // メディアボタンをクリックしてファイル入力を開く
      let fileInput = await page.$('input[type="file"]');
      if (!fileInput) {
        try {
          // メディア添付ボタン
          await page.click('[data-testid="attachments"]');
          await sleep(1500);
        } catch (e) {
          try {
            // 画像アイコンボタン
            const mediaBtn = await page.$('[aria-label="画像を追加"], [aria-label="Add photos or video"]');
            if (mediaBtn) await mediaBtn.click();
            await sleep(1500);
          } catch (e2) {}
        }
        fileInput = await page.$('input[type="file"]');
      }

      if (!fileInput) {
        await page.screenshot({ path: '/tmp/x-personal-no-file-input.png' });
        console.warn('⚠️  ファイル入力が見つかりません - メディアなしで投稿継続');
      } else {
        await fileInput.uploadFile(imgPath);
        console.log(`✅ ${isVideoFile ? '動画' : '画像'}アップロード開始`);

        // 動画は処理時間が長い（最大2分待機）
        const waitTime = isVideoFile ? 90000 : 10000;
        console.log(`⏳ メディア処理待機中... (最大${waitTime / 1000}秒)`);
        try {
          await page.waitForSelector('[data-testid="attachments"]', { timeout: waitTime });
          console.log('✅ メディアアップロード完了');
        } catch (e) {
          console.warn('⚠️  メディアプレビュー確認タイムアウト（投稿は継続）');
        }
      }
    }

    await page.screenshot({ path: '/tmp/x-personal-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/x-personal-before-post.png');

    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      await browser.close();
      return { success: true, dryRun: true, platform: 'X-Personal' };
    }

    // 投稿ボタン
    console.log('📤 投稿ボタンをクリック...');
    await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 15000 });
    await page.click('[data-testid="tweetButton"]');
    await sleep(5000);

    await page.screenshot({ path: '/tmp/x-personal-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/x-personal-after-post.png');
    console.log('✅ X個人アカウント投稿完了！');

    return { success: true, platform: 'X-Personal', screenshot: '/tmp/x-personal-after-post.png' };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/x-personal-error.png' }); } catch (e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// リトライロジック
async function postWithRetry(maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await postToX(postText, mediaPath);
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
