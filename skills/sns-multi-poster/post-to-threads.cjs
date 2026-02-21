#!/usr/bin/env node
/**
 * Threads 投稿スクリプト v3 - 修正版
 * 正しいフロー: "What's new?" クリック → テキスト入力 → 画像 → Post
 *
 * Usage: node post-to-threads.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-threads.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Threads投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

const IG_COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const THREADS_COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToThreads() {
  console.log('🧵 Threads に投稿開始 (v3)');
  console.log(`🖼️  ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);

  // Cookieパス決定
  let cookiesPath = fs.existsSync(THREADS_COOKIES_PATH) ? THREADS_COOKIES_PATH : IG_COOKIES_PATH;
  if (!fs.existsSync(cookiesPath)) throw new Error('Cookieファイルが見つかりません');
  console.log(`🔐 Cookie使用: ${path.basename(cookiesPath)}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900','--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  try {
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8' });

    // Cookie設定
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    const cookies = cookiesData.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.threads.net', path: c.path || '/',
      secure: c.secure !== false, httpOnly: c.httpOnly === true,
      ...(c.expirationDate ? { expires: Math.floor(c.expirationDate) } : {})
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // Threads にアクセス
    console.log('🌐 Threads.netにアクセス中...');
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(4000);

    // ログイン確認
    const currentUrl = page.url();
    console.log(`📍 URL: ${currentUrl}`);
    if (currentUrl.includes('/login') || currentUrl.includes('accounts/login')) {
      await page.screenshot({ path: '/tmp/threads-login-error.png' });
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');
    await page.screenshot({ path: '/tmp/threads-home.png' });

    // ─── Step 1: "What's new?" エリアをクリックしてコンポーズモーダルを開く ───
    console.log('➕ 投稿エリアをクリック...');

    // "What's new?" テキストエリアをクリック（Postボタンではない）
    const composeClicked = await page.evaluate(() => {
      // placeholder or text "What's new?" を探す
      const candidates = Array.from(document.querySelectorAll(
        '[placeholder*="What"], [placeholder*="新しい"], [data-lexical-editor], [contenteditable]'
      ));
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.width > 100 && r.height > 0) {
          el.click();
          return 'contenteditable/placeholder found';
        }
      }

      // テキスト "What's new?" を持つ要素を探す
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        const txt = el.getAttribute('placeholder') || '';
        if ((txt.includes("What's new") || txt.includes('新しい')) && el.getBoundingClientRect().width > 0) {
          el.click();
          return `placeholder: ${txt}`;
        }
      }
      return null;
    });

    if (composeClicked) {
      console.log(`✅ コンポーズエリアクリック: ${composeClicked}`);
    } else {
      // フォールバック: "+" ボタンや作成ボタンをクリック
      const fallbackClicked = await page.evaluate(() => {
        // 左サイドバーの中央あたりにある投稿作成ボタンを探す
        const svgs = Array.from(document.querySelectorAll('svg'));
        for (const svg of svgs) {
          const parent = svg.closest('[role="link"], [role="button"], a');
          if (parent) {
            const aria = parent.getAttribute('aria-label') || '';
            if (aria.toLowerCase().includes('new') || aria.toLowerCase().includes('create') || aria.toLowerCase().includes('作成')) {
              parent.click();
              return aria;
            }
          }
        }
        return null;
      });
      if (fallbackClicked) {
        console.log(`✅ フォールバック: ${fallbackClicked}`);
      } else {
        console.warn('⚠️  コンポーズボタンが見つからず、直接クリック試行');
        // 中央付近の「+」ボタンを座標クリック
        await page.mouse.click(37, 444); // 左サイドバーの投稿ボタン位置
      }
    }

    await sleep(2000);
    await page.screenshot({ path: '/tmp/threads-after-click.png' });

    // ─── Step 2: テキスト入力エリアを探して入力 ───
    console.log('📝 テキスト入力中...');

    // モーダル内の contenteditable エリアを待つ
    let textEl = null;
    const textSelectors = [
      'div[contenteditable="true"][data-lexical-editor]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'textarea',
    ];

    for (const sel of textSelectors) {
      try {
        textEl = await page.waitForSelector(sel, { timeout: 8000, visible: true });
        if (textEl) {
          console.log(`✅ テキスト入力エリア発見: ${sel}`);
          break;
        }
      } catch(e) {}
    }

    if (textEl) {
      await textEl.click();
      await sleep(500);
      await page.keyboard.type(caption, { delay: 25 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  テキスト入力エリアが見つかりません');
    }

    await sleep(1000);

    // ─── Step 3: 画像アップロード ───
    console.log('📷 画像アップロード中...');

    // input[type="file"] を探す
    let fileInput = await page.$('input[type="file"]');

    if (!fileInput) {
      // 添付/画像ボタンを探してクリック
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 8000 }).catch(() => null),
        page.evaluate(() => {
          const labels = ['attach', 'photo', 'media', 'image', '画像', '添付'];
          const els = Array.from(document.querySelectorAll('button, [role="button"], svg'));
          for (const el of els) {
            const lbl = (el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label') || '').toLowerCase();
            if (labels.some(l => lbl.includes(l))) {
              el.click();
              return lbl;
            }
          }
          return null;
        })
      ]).catch(e => [null, null]);

      if (fileChooser) {
        await fileChooser.accept([imagePath]);
        console.log('✅ FileChooser経由でアップロード');
        await sleep(3000);
      } else {
        fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.uploadFile(imagePath);
          console.log('✅ ファイル入力直接アップロード');
          await sleep(3000);
        } else {
          console.warn('⚠️  ファイル入力なし - テキストのみで投稿');
        }
      }
    } else {
      await fileInput.uploadFile(imagePath);
      console.log('✅ 画像アップロード完了');
      await sleep(3000);
    }

    await page.screenshot({ path: '/tmp/threads-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/threads-before-post.png');

    // ─── Step 4: 投稿ボタンをクリック ───
    console.log('📤 投稿ボタンをクリック...');

    // モーダル内の下部にある "Post" ボタン（送信ボタン）を探す
    // 注意: サイドバーにも "Post" ボタンがある（透明bg）→ 除外する
    const postClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));

      // 1. "Cancel" ボタンと同じ親コンテナ内の "Post" ボタンを探す（モーダル内）
      const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel' || b.textContent.trim() === 'キャンセル');
      if (cancelBtn) {
        // Cancel の親要素（モーダルコンテナ）を探す
        let container = cancelBtn.parentElement;
        while (container && container !== document.body) {
          const postInContainer = Array.from(container.querySelectorAll('button, [role="button"]'))
            .find(b => {
              const txt = b.textContent.trim();
              if (txt !== 'Post' && txt !== '投稿') return false;
              if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
              const r = b.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
          if (postInContainer) {
            const style = window.getComputedStyle(postInContainer);
            postInContainer.click();
            return `Modal Post: "${postInContainer.textContent.trim()}" (bg: ${style.backgroundColor})`;
          }
          container = container.parentElement;
        }
      }

      // 2. フォールバック: ページ下部にある "Post" ボタン（y座標 > 600）を探す
      for (const btn of btns) {
        const txt = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
        if ((txt === 'Post' || txt === '投稿') && !btn.disabled) {
          const r = btn.getBoundingClientRect();
          // 画面下部かつ左寄りでないボタン（サイドバーのPostはy≈500付近）
          if (r.width > 0 && r.top > 600) {
            const style = window.getComputedStyle(btn);
            btn.click();
            return `Bottom Post: "${txt}" at top=${Math.round(r.top)} (bg: ${style.backgroundColor})`;
          }
        }
      }

      // 3. 最終フォールバック: 黒背景の "Post" ボタン
      for (const btn of btns) {
        const txt = (btn.textContent || '').trim();
        if (txt === 'Post' || txt === '投稿') {
          const style = window.getComputedStyle(btn);
          const bg = style.backgroundColor;
          // 背景が黒系 (rgb(0,0,0) or dark) → 送信ボタン
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const r = btn.getBoundingClientRect();
            if (r.width > 0) {
              btn.click();
              return `Dark bg Post: "${txt}" (bg: ${bg})`;
            }
          }
        }
      }

      return null;
    });

    if (postClicked) {
      console.log(`✅ 投稿ボタンクリック: ${postClicked}`);
    } else {
      console.warn('⚠️  投稿ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/threads-no-post-btn.png' });
      throw new Error('投稿ボタンが見つかりません');
    }

    await sleep(5000);
    await page.screenshot({ path: '/tmp/threads-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/threads-after-post.png');
    console.log('✅ Threads投稿完了！');

    return { success: true, platform: 'Threads' };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    try { await page.screenshot({ path: '/tmp/threads-error.png' }); } catch(e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// リトライロジック（最大2回）
async function postWithRetry(maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await postToThreads();
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
