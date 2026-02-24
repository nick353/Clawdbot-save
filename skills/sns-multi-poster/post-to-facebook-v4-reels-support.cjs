#!/usr/bin/env node
/**
 * Facebook 投稿スクリプト v4 - Reels対応版
 * 動画投稿時の "Edit reel" 画面をスクロールしてPostボタンを探す
 *
 * Usage: node post-to-facebook-v4-reels-support.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-facebook-v4-reels-support.cjs <image_path> <caption>');
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
function randomDelay(min, max) { return sleep(Math.floor(Math.random() * (max - min + 1) + min)); }

async function postToFacebook() {
  console.log('📘 Facebook に投稿開始 (v4 - Reels対応版)');
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

    // Cookie設定（sameSite正規化）
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = cookiesData.map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.facebook.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // Facebookにアクセス
    console.log('🌐 Facebook にアクセス中...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await randomDelay(3000, 5000);

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

    await randomDelay(3000, 5000);

    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
      console.log('✅ 投稿モーダル確認');
    } catch(e) {
      console.log('⚠️ モーダル検出タイムアウト、続行...');
    }

    // ─── Step 2: 写真/動画ボタンをクリック ───
    console.log('📷 写真追加中...');

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
          if (lbl.includes('Photo') || lbl.includes('写真')) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) { btn.click(); return true; }
          }
        }
        return false;
      });
      if (photoClicked) console.log('✅ Photo ボタン (フォールバック) クリック');
    }

    await randomDelay(2000, 4000);

    // ファイル入力を探す
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      try {
        const [chooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 5000 }),
          Promise.resolve()
        ]);
        if (chooser) {
          await chooser.accept([imagePath]);
          console.log('✅ FileChooser経由でアップロード');
          await randomDelay(5000, 7000);
        }
      } catch(e) {
        fileInput = await page.$('input[type="file"]');
      }
    }

    if (fileInput) {
      await fileInput.uploadFile(imagePath);
      console.log('✅ ファイルアップロード開始');
      await randomDelay(5000, 7000);
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
          await randomDelay(500, 1000);
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

    await randomDelay(2000, 3000);
    await page.screenshot({ path: '/tmp/facebook-before-next.png' });

    // ─── Step 4: "Next" ボタンをクリック ───
    console.log('📤 Next ボタンを探しています...');

    const nextClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="dialog"] [role="button"], [role="dialog"] button'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (/^Next$/i.test(txt) || txt === '次へ') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && !btn.getAttribute('aria-disabled')) {
            btn.click();
            return txt;
          }
        }
      }
      return null;
    });

    if (nextClicked) {
      console.log(`✅ Next ボタンクリック: ${nextClicked}`);
      await randomDelay(5000, 8000); // Reels編集画面の読み込み待機
      await page.screenshot({ path: '/tmp/facebook-after-next.png' });
    } else {
      console.warn('⚠️ Next ボタンが見つかりません');
    }

    // ─── Step 5: Reels編集画面の場合、左側パネルをスクロール ───
    console.log('🔍 Reels編集画面を確認中...');

    const isReelsScreen = await page.evaluate(() => {
      const heading = document.querySelector('h1, h2');
      return heading && heading.textContent.includes('Edit reel');
    });

    if (isReelsScreen) {
      console.log('✅ Reels編集画面を検出 - 左側パネルをスクロールします');
      
      // 左側パネルをスクロールdown
      await page.evaluate(() => {
        // 複数の方法で左側パネルをスクロール
        const selectors = [
          '[role="dialog"] > div > div',
          '[role="dialog"] > div',
          'div[style*="overflow"]',
        ];
        
        for (const sel of selectors) {
          const panels = document.querySelectorAll(sel);
          for (const panel of panels) {
            if (panel.scrollHeight > panel.clientHeight) {
              panel.scrollTop = panel.scrollHeight;
              console.log(`スクロール: ${sel}`);
            }
          }
        }
        
        // ページ全体もスクロール
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await randomDelay(2000, 3000);
      await page.screenshot({ path: '/tmp/facebook-after-scroll.png' });
      console.log('📸 スクロール後スクリーンショット: /tmp/facebook-after-scroll.png');
    }

    // ─── Step 6: "Post" または "Share" ボタンをクリック ───
    console.log('📤 Post/Share ボタンを探しています...');

    const postClicked = await page.evaluate(() => {
      const selectors = [
        '[role="dialog"] [role="button"]',
        '[role="dialog"] button',
        'button',
        '[role="button"]',
      ];
      
      for (const sel of [].concat(selectors)) {
        const btns = Array.from(document.querySelectorAll(sel));
        for (const btn of btns) {
          const txt = btn.textContent.trim();
          const aria = btn.getAttribute('aria-label') || '';
          
          // Post, Share, 投稿ボタンを探す
          if ((txt === 'Post' || txt === 'Share' || txt === '投稿' || 
               txt === 'Publish' || aria.includes('Post')) &&
              !btn.getAttribute('aria-disabled') &&
              btn.getAttribute('aria-disabled') !== 'true') {
            
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              btn.click();
              return `"${txt}" (aria: "${aria}", position: ${r.top}x${r.left})`;
            }
          }
        }
      }
      return null;
    });

    if (postClicked) {
      console.log(`✅ Post/Share ボタンクリック: ${postClicked}`);
    } else {
      await page.screenshot({ path: '/tmp/facebook-no-post-button.png' });
      console.log('📸 エラースクリーンショット: /tmp/facebook-no-post-button.png');
      
      // デバッグ: 画面上の全てのボタンを列挙
      const allButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        return btns.map(btn => ({
          text: btn.textContent.trim().substring(0, 50),
          aria: btn.getAttribute('aria-label'),
          disabled: btn.getAttribute('aria-disabled') || btn.getAttribute('disabled'),
        })).filter(b => b.text || b.aria);
      });
      console.log('🔍 検出されたボタン:', JSON.stringify(allButtons, null, 2));
      
      throw new Error('Post/Share ボタンが見つかりません');
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
