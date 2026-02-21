#!/usr/bin/env node
/**
 * LinkedIn 投稿スクリプト - Cookie認証版 + Stealth
 *
 * Usage: node post-to-linkedin.cjs "投稿テキスト" [画像パス（オプション）]
 *
 * Cookie: /root/clawd/skills/sns-curator/cookies/linkedin.json
 *   - Chrome拡張 "Cookie Editor" でエクスポートしたJSONを配置
 *   - 空 [] の場合はスキップします
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const postText = process.argv[2];
const imagePath = process.argv[3] || null;

if (!postText) {
  console.error('使い方: node post-to-linkedin.cjs "投稿テキスト" [画像パス]');
  process.exit(1);
}

if (imagePath && !fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/linkedin.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Cookieファイルの検証
 * 空配列 [] や存在しない場合はスキップメッセージを出して終了
 */
function validateCookies() {
  if (!fs.existsSync(COOKIES_PATH)) {
    console.error('⚠️  LinkedInのCookieファイルが見つかりません。');
    console.error(`   配置先: ${COOKIES_PATH}`);
    console.error('   Chrome拡張 "Cookie Editor" でlinkedin.comのCookieをエクスポートして配置してください。');
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
    console.error('⚠️  LinkedInのCookieが設定されていません（空の配列）。');
    console.error(`   配置先: ${COOKIES_PATH}`);
    console.error('   Chrome拡張 "Cookie Editor" でlinkedin.comのCookieをエクスポートして配置してください。');
    console.error('   詳細: SKILL.md の "Cookie取得方法" を参照');
    return false;
  }

  return cookies;
}

async function postToLinkedIn(text, imgPath) {
  console.log('💼 LinkedIn に投稿開始...');
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
      '--disable-blink-features=AutomationControlled',
      '--memory-pressure-off',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--js-flags=--max-old-space-size=256'
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

    // LinkedIn フィードにアクセス
    console.log('📂 LinkedIn にアクセス中...');
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await sleep(3000);

    // ログイン確認
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/uas/')) {
      await page.screenshot({ path: '/tmp/linkedin-login-error.png' });
      throw new Error('LinkedInへのログインが必要です。Cookieが期限切れの可能性があります。');
    }
    console.log('✅ ログイン確認完了');

    // 「投稿を開始」ボタンを探してクリック
    console.log('🖱️  投稿ダイアログを開く...');
    const shareButtonSelectors = [
      'button[data-control-name="share.open_share_window"]',
      '[aria-label="投稿を開始"]',
      '[aria-label="Start a post"]',
      '.share-box-feed-entry__trigger',
      '[data-urn*="share-box"] button',
      '.share-creation-state__trigger'
    ];

    let clicked = false;
    for (const sel of shareButtonSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.click(sel);
        clicked = true;
        console.log(`✅ 投稿ボタンをクリック: ${sel}`);
        break;
      } catch (e) {
        // 次のセレクターを試す
      }
    }

    if (!clicked) {
      // テキストで検索する最終手段
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const target = buttons.find(b =>
            b.textContent.includes('投稿を開始') ||
            b.textContent.includes('Start a post') ||
            b.textContent.includes('Create a post')
          );
          if (target) target.click();
        });
        clicked = true;
        console.log('✅ テキスト検索で投稿ボタンをクリック');
      } catch (e) {
        await page.screenshot({ path: '/tmp/linkedin-no-button.png' });
        throw new Error('投稿ボタンが見つかりませんでした。スクリーンショット: /tmp/linkedin-no-button.png');
      }
    }

    await sleep(2000);

    // テキストエリアを探す
    console.log('📝 テキスト入力中...');
    const textAreaSelectors = [
      '.ql-editor',
      '[data-placeholder]',
      '[contenteditable="true"]',
      '.share-creation-state__text-editor [contenteditable]'
    ];

    let textAreaFound = false;
    for (const sel of textAreaSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.click(sel);
        await sleep(500);
        // contenteditable の場合はkeyboardで入力
        await page.keyboard.type(text, { delay: 20 });
        textAreaFound = true;
        console.log(`✅ テキスト入力完了: ${sel}`);
        break;
      } catch (e) {
        // 次を試す
      }
    }

    if (!textAreaFound) {
      await page.screenshot({ path: '/tmp/linkedin-no-textarea.png' });
      throw new Error('テキストエリアが見つかりませんでした。スクリーンショット: /tmp/linkedin-no-textarea.png');
    }

    await sleep(1000);

    // 画像アップロード（オプション）
    if (imgPath) {
      console.log('📷 画像をアップロード中...');
      // メディアボタンを探す
      const mediaSelectors = [
        'button[aria-label*="写真"]',
        'button[aria-label*="Photo"]',
        'button[aria-label*="画像"]',
        '[data-control-name="share.photo"]',
        '.share-creation-state__toolbar button:first-child'
      ];

      let mediaClicked = false;
      for (const sel of mediaSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 3000 });
          await page.click(sel);
          mediaClicked = true;
          console.log(`✅ メディアボタンをクリック: ${sel}`);
          break;
        } catch (e) {
          // 次を試す
        }
      }

      if (mediaClicked) {
        await sleep(1000);
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(imgPath);
          console.log('✅ 画像アップロード開始');
          await sleep(5000);
        } else {
          console.warn('⚠️  ファイル入力が見つかりませんでした。画像なしで続行します。');
        }
      } else {
        console.warn('⚠️  メディアボタンが見つかりませんでした。画像なしで続行します。');
      }
    }

    await page.screenshot({ path: '/tmp/linkedin-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/linkedin-before-post.png');

    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      await browser.close();
      return { success: true, dryRun: true, platform: 'LinkedIn' };
    }

    // 「投稿する」ボタンをクリック
    console.log('📤 投稿ボタンをクリック...');
    const submitSelectors = [
      'button[data-control-name="share.post"]',
      'button.share-actions__primary-action',
      '[aria-label="投稿する"]',
      '[aria-label="Post"]',
      'button.artdeco-button--primary'
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.click(sel);
        submitted = true;
        console.log(`✅ 投稿ボタンをクリック: ${sel}`);
        break;
      } catch (e) {
        // 次を試す
      }
    }

    if (!submitted) {
      // テキストで最終手段
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const target = buttons.find(b =>
            b.textContent.trim() === '投稿する' ||
            b.textContent.trim() === 'Post' ||
            b.textContent.trim() === '投稿'
          );
          if (target) target.click();
        });
        submitted = true;
        console.log('✅ テキスト検索で投稿ボタンをクリック');
      } catch (e) {
        await page.screenshot({ path: '/tmp/linkedin-no-submit.png' });
        throw new Error('投稿ボタンが見つかりませんでした。スクリーンショット: /tmp/linkedin-no-submit.png');
      }
    }

    await sleep(5000);
    await page.screenshot({ path: '/tmp/linkedin-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/linkedin-after-post.png');
    console.log('✅ LinkedIn投稿完了！');

    return { success: true, platform: 'LinkedIn', screenshot: '/tmp/linkedin-after-post.png' };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/linkedin-error.png' }); } catch (e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// リトライロジック
async function postWithRetry(maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await postToLinkedIn(postText, imagePath);
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
