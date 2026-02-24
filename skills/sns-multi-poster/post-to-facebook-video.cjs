#!/usr/bin/env node
/**
 * Facebook 動画投稿スクリプト
 * 正しいフロー: "What's on your mind" → キャプション入力 → 動画追加 → スクロール → Post
 *
 * Usage: node post-to-facebook-video.cjs <video_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, videoPath, caption] = process.argv;

if (!videoPath || !caption) {
  console.error('使い方: node post-to-facebook-video.cjs <video_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`❌ 動画が見つかりません: ${videoPath}`);
  process.exit(1);
}

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Facebook動画投稿スキップ');
  console.log(`🎥 動画: ${videoPath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/facebook.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToFacebook() {
  console.log('📘 Facebook に動画投稿開始');
  console.log(`🎥 ${videoPath}`);
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
      await page.screenshot({ path: '/tmp/facebook-video-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/facebook-video-home.png' });

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
      const pagelet = document.querySelector('[data-pagelet="FeedUnit_0"] [role="button"]');
      if (pagelet) { pagelet.click(); return 'pagelet button'; }
      return null;
    });

    if (modalOpened) {
      console.log(`✅ 投稿エリアクリック: ${modalOpened}`);
    } else {
      try {
        await page.click('[aria-label*="Create a post"], [aria-label*="Write something"]');
        console.log('✅ aria-label でクリック');
      } catch(e) {
        console.warn('⚠️  投稿エリアボタンが見つかりません');
      }
    }

    await sleep(3000);

    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      console.log('✅ 投稿モーダル確認');
    } catch(e) {
      console.log('⚠️ モーダル検出タイムアウト、続行...');
    }

    // ─── Step 2: 写真/動画ボタンをクリック ───
    console.log('🎥 動画追加中...');

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
      photoClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        for (const btn of btns) {
          const lbl = btn.getAttribute('aria-label') || btn.textContent || '';
          if (lbl.includes('Photo') || lbl.includes('Video') || lbl.includes('写真') || lbl.includes('動画')) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) { btn.click(); return true; }
          }
        }
        return false;
      });
      if (photoClicked) console.log('✅ Photo/Video ボタン (フォールバック) クリック');
    }

    await sleep(2000);

    // ファイル入力
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      try {
        const [chooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 5000 }),
          Promise.resolve()
        ]);
        if (chooser) {
          await chooser.accept([videoPath]);
          console.log('✅ FileChooser経由でアップロード');
          await sleep(8000);
        }
      } catch(e) {
        fileInput = await page.$('input[type="file"]');
      }
    }

    if (fileInput) {
      await fileInput.uploadFile(videoPath);
      console.log('✅ 動画アップロード開始');
      await sleep(8000);
    }

    // アップロード完了を待つ
    try {
      await page.waitForFunction(() => {
        const vids = document.querySelectorAll('[role="dialog"] video');
        return vids.length > 0;
      }, { timeout: 20000 });
      console.log('✅ 動画アップロード完了確認');
    } catch(e) {
      console.log('⚠️ 動画確認タイムアウト、続行...');
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
    await page.screenshot({ path: '/tmp/facebook-video-before-post.png' });

    // ─── Step 4: 動画処理完了を待つ ───
    console.log('⏳ 動画処理完了を待機中...');
    await sleep(15000); // 15秒待機（動画処理完了を待つ）

    // ─── Step 5: モーダルをスクロールして Post ボタンを探す ───
    console.log('📤 Post ボタンを探しています...');

    try {
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) modal.scrollTop = modal.scrollHeight;
      });
      await sleep(2000);
    } catch(e) {}

    // デバッグ: 全てのボタンを出力
    const allButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] [role="button"], [role="dialog"] button'));
      return btns.map(btn => ({
        text: btn.textContent.trim().substring(0, 50),
        aria: btn.getAttribute('aria-label') || '',
        disabled: btn.getAttribute('aria-disabled') || btn.getAttribute('disabled'),
        width: btn.getBoundingClientRect().width,
        top: btn.getBoundingClientRect().top,
      }));
    });
    console.log('🔍 モーダル内の全ボタン:', JSON.stringify(allButtons, null, 2));

    // Post ボタンをクリック（複数パターン）
    const postClicked = await page.evaluate(() => {
      const selectors = [
        '[role="dialog"] [role="button"]',
        '[role="dialog"] button',
        'button',
        '[role="button"]',
      ];
      
      for (const sel of selectors) {
        const btns = Array.from(document.querySelectorAll(sel));
        for (const btn of btns) {
          const txt = btn.textContent.trim();
          const aria = btn.getAttribute('aria-label') || '';
          const disabled = btn.getAttribute('aria-disabled') || btn.getAttribute('disabled');
          
          // Post ボタンを複数パターンで検出
          if ((txt === 'Post' || txt === '投稿' || txt === 'Share' || 
               aria === 'Post' || aria === 'Share' || 
               txt.includes('Post') || aria.includes('Post')) &&
              !disabled && disabled !== 'true') {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.top >= 0) {
              btn.click();
              return `"${txt}" (aria: "${aria}") at top=${r.top}`;
            }
          }
        }
      }
      return null;
    });

    if (postClicked) {
      console.log(`✅ Post ボタンクリック: ${postClicked}`);
    } else {
      await page.screenshot({ path: '/tmp/facebook-video-no-post-button.png' });
      throw new Error('Post ボタンが見つかりません');
    }

    await sleep(6000);
    await page.screenshot({ path: '/tmp/facebook-video-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/facebook-video-after-post.png');
    console.log('✅ Facebook動画投稿完了！');

    return { success: true, platform: 'Facebook' };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/facebook-video-error.png' }); } catch(e) {}
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
