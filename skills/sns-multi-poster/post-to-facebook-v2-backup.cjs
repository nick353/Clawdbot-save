#!/usr/bin/env node
/**
 * Facebook 投稿スクリプト v2 - 修正版
 * 正しいフロー: "What's on your mind" → キャプション入力 → 写真追加 → スクロール → Post
 *
 * Usage: node post-to-facebook.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-facebook.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Facebook投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/facebook.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToFacebook() {
  console.log('📘 Facebook に投稿開始 (v2)');
  console.log(`🖼️  ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900','--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  try {
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    // Cookie設定
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = cookiesData.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.facebook.com', path: c.path || '/',
      secure: c.secure !== false, httpOnly: c.httpOnly === true,
      sameSite: 'Lax',
      ...(c.expirationDate ? { expires: Math.floor(c.expirationDate) } : {})
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // Facebookにアクセス
    console.log('🌐 Facebook にアクセス中...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(4000);

    // ログイン確認
    const currentUrl = page.url();
    console.log(`📍 URL: ${currentUrl}`);
    if (currentUrl.includes('/login')) {
      await page.screenshot({ path: '/tmp/facebook-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/facebook-home.png' });

    // ─── Step 1: "What's on your mind?" クリック ───
    console.log('📝 投稿エリアを開く...');

    const modalOpened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"]'));
      for (const btn of btns) {
        const txt = btn.textContent || '';
        const aria = btn.getAttribute('aria-label') || '';
        if (txt.includes("What's on your mind") || txt.includes("NisenPrints") ||
            aria.includes("What's on your mind") || aria.includes("Create a post")) {
          const r = btn.getBoundingClientRect();
          if (r.width > 100) { btn.click(); return txt.trim().substring(0, 50); }
        }
      }
      // フォールバック: data-pagelet内のボタン
      const pagelet = document.querySelector('[data-pagelet="FeedUnit_0"] [role="button"]');
      if (pagelet) { pagelet.click(); return 'pagelet button'; }
      return null;
    });

    if (modalOpened) {
      console.log(`✅ 投稿エリアクリック: ${modalOpened}`);
    } else {
      // フォールバック: aria-labelで探す
      try {
        await page.click('[aria-label*="Create a post"], [aria-label*="Write something"]');
        console.log('✅ aria-label でクリック');
      } catch(e) {
        console.warn('⚠️  投稿エリアボタンが見つかりません');
      }
    }

    await sleep(3000);

    // モーダルが開くのを待つ
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      console.log('✅ 投稿モーダル確認');
    } catch(e) {
      console.log('⚠️ モーダル検出タイムアウト、続行...');
    }

    // ─── Step 2: 写真/動画ボタンをクリック（先に写真を追加） ───
    console.log('📷 写真追加中...');

    // Photo/video ボタンをクリック
    let photoClicked = false;
    try {
      const photoBtns = await page.$$('[aria-label="Photo/video"], [aria-label="写真/動画"]');
      for (const btn of photoBtns) {
        const r = await btn.boundingBox();
        if (r && r.width > 0) {
          await btn.click();
          photoClicked = true;
          console.log('✅ Photo/video ボタンクリック');
          break;
        }
      }
    } catch(e) {}

    if (!photoClicked) {
      // テキスト検索
      photoClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        for (const btn of btns) {
          const lbl = btn.getAttribute('aria-label') || btn.textContent || '';
          if (lbl.includes('Photo') || lbl.includes('写真')) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) { btn.click(); return true; }
          }
        }
        return false;
      });
      if (photoClicked) console.log('✅ Photo ボタン (フォールバック) クリック');
    }

    await sleep(2000);

    // ファイル入力を探す
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // ファイル選択ダイアログを待つ
      try {
        const [chooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 5000 }),
          Promise.resolve()
        ]);
        if (chooser) {
          await chooser.accept([imagePath]);
          console.log('✅ FileChooser経由でアップロード');
          await sleep(5000);
        }
      } catch(e) {
        fileInput = await page.$('input[type="file"]');
      }
    }

    if (fileInput) {
      await fileInput.uploadFile(imagePath);
      console.log('✅ ファイルアップロード開始');
      await sleep(5000);
    }

    // アップロード完了を待つ
    try {
      await page.waitForFunction(() => {
        const imgs = document.querySelectorAll('[role="dialog"] img');
        return imgs.length > 0;
      }, { timeout: 15000 });
      console.log('✅ 画像アップロード完了確認');
    } catch(e) {
      console.log('⚠️ 画像確認タイムアウト、続行...');
    }

    // ─── Step 3: キャプション入力 ───
    console.log('📝 キャプション入力中...');

    const textSelectors = [
      '[role="dialog"] [contenteditable="true"]',
      '[role="dialog"] [role="textbox"]',
      '[contenteditable="true"][role="textbox"]',
      '[data-contents="true"]',
    ];

    let captionEntered = false;
    for (const sel of textSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await sleep(500);
          await page.keyboard.type(caption, { delay: 30 });
          captionEntered = true;
          console.log(`✅ キャプション入力完了 (${sel})`);
          break;
        }
      } catch(e) {}
    }

    if (!captionEntered) {
      console.warn('⚠️ キャプション入力エリアが見つかりません');
    }

    await sleep(2000);
    await page.screenshot({ path: '/tmp/facebook-before-post.png' });

    // ─── Step 4: モーダルをスクロールして Post ボタンを探す ───
    console.log('📤 Post ボタンを探しています...');

    // モーダル内をスクロールdown
    try {
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) modal.scrollTop = modal.scrollHeight;
      });
      await sleep(1000);
    } catch(e) {}

    // Next → Post の2ステップの可能性もあるのでNextを試す
    const nextResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] [role="button"], [role="dialog"] button'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === 'Next' || txt === '次へ') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && !btn.getAttribute('aria-disabled')) {
            btn.click();
            return txt;
          }
        }
      }
      return null;
    });

    if (nextResult) {
      console.log(`✅ Next ボタンクリック: ${nextResult}`);
      await sleep(3000);
      await page.screenshot({ path: '/tmp/facebook-next-step.png' });
    }

    // Post ボタンをクリック
    const postClicked = await page.evaluate(() => {
      // すべてのボタンを検索（ダイアログ内外）
      const selectors = [
        '[role="dialog"] [role="button"]',
        '[role="dialog"] button',
      ];
      for (const sel of [].concat(selectors)) {
        const btns = Array.from(document.querySelectorAll(sel));
        for (const btn of btns) {
          const txt = btn.textContent.trim();
          const aria = btn.getAttribute('aria-label') || '';
          if ((txt === 'Post' || txt === '投稿' || aria === 'Post') &&
              !btn.getAttribute('aria-disabled') &&
              btn.getAttribute('aria-disabled') !== 'true') {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) {
              btn.click();
              return `"${txt}" (aria: "${aria}")`;
            }
          }
        }
      }

      // フォールバック: 全ページのPostボタン
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of allBtns) {
        const txt = btn.textContent.trim();
        if (txt === 'Post' && !btn.getAttribute('disabled')) {
          const r = btn.getBoundingClientRect();
          // ページの下部にあるボタン（Postフォームの送信ボタン）を狙う
          if (r.width > 50 && r.top > 300) {
            btn.click();
            return `fallback: "${txt}" at top=${r.top}`;
          }
        }
      }
      return null;
    });

    if (postClicked) {
      console.log(`✅ Post ボタンクリック: ${postClicked}`);
    } else {
      await page.screenshot({ path: '/tmp/facebook-no-post-button.png' });
      throw new Error('Post ボタンが見つかりません');
    }

    // 投稿完了を待つ
    await sleep(6000);
    await page.screenshot({ path: '/tmp/facebook-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/facebook-after-post.png');
    console.log('✅ Facebook投稿完了！');

    return { success: true, platform: 'Facebook' };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/facebook-error.png' }); } catch(e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// リトライロジック
async function postWithRetry(maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await postToFacebook();
    } catch(err) {
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
  .then(() => { console.log('\n✅ 投稿成功！'); process.exit(0); })
  .catch(e => { console.error('\n❌ 投稿失敗:', e.message); process.exit(1); });
