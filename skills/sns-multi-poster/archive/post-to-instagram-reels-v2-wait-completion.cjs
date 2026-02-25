#!/usr/bin/env node
/**
 * Instagram Reels 投稿スクリプト v2 - 投稿完了を待機
 * Cookie JSONファイルから直接セッション復元 → 動画投稿 → 完了確認
 *
 * Usage: node post-to-instagram-reels-v2-wait-completion.cjs <video_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, videoPath, caption] = process.argv;

if (!videoPath || !caption) {
  console.error('使い方: node post-to-instagram-reels-v2-wait-completion.cjs <video_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(videoPath)) {
  console.error(`❌ 動画が見つかりません: ${videoPath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-reels-${label}-${ts}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${p}`);
  return p;
}

async function waitFor(page, selectors, desc, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const vis = await page.evaluate(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }, el);
          if (vis) return el;
        }
      } catch (e) { /* retry */ }
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.error(`❌ タイムアウト: ${desc}`);
  return null;
}

async function clickText(page, texts, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await page.evaluate(ts => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        if (ts.some(t => el.innerText?.trim().toLowerCase().includes(t.toLowerCase()))) {
          el.click();
          return el.innerText.trim();
        }
      }
      return null;
    }, texts);
    if (r) { console.log(`✅ クリック: "${r}"`); return true; }
    await new Promise(r => setTimeout(r, 800));
  }
  return false;
}

async function main() {
  // DRY RUN チェック
  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Instagram Reels投稿スキップ');
    console.log(`🎥 動画: ${videoPath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  console.log('🎥 Instagram Reels 投稿開始');
  console.log(`📹 ${videoPath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // ─── Step 1: Cookie事前セット ───
    console.log('🔐 Step 1: Cookie事前設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => {
      const cookie = {
        name: c.name,
        value: decodeURIComponent(c.value),
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
      };
      const sm = c.sameSite;
      if (sm === 'no_restriction') cookie.sameSite = 'None';
      else if (sm === 'lax') cookie.sameSite = 'Lax';
      else if (sm === 'strict') cookie.sameSite = 'Strict';
      else cookie.sameSite = 'None';
      const exp = c.expirationDate || c.expires;
      if (exp) cookie.expires = Math.floor(exp);
      return cookie;
    });
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // ─── Step 2: Instagram.com に直接ナビゲート ───
    console.log('🌐 Step 2: Instagram に移動中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
    console.log('✅ ページ読み込み完了');
    
    await new Promise(r => setTimeout(r, 10000));
    await shot(page, '03-after-reload');

    // ─── Step 4: ログイン確認 ───
    const url = page.url();
    const content = await page.content();
    console.log(`📍 URL: ${url}`);

    if (url.includes('/accounts/login') || content.includes('Log in to Instagram')) {
      console.error('❌ ログインが必要です（Cookie無効）');
      throw new Error('Cookie invalid - login required');
    }

    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label]'))
        .map(e => e.getAttribute('aria-label')).filter(Boolean)
    );
    console.log('🔍 aria-labels:', labels.slice(0, 15).join(', '));

    const isLoggedIn = labels.some(l =>
      ['New post', '新規投稿', 'Home', 'Search', 'Profile', 'Explore'].includes(l)
    );
    if (!isLoggedIn && content.includes('Log into Instagram')) {
      console.error('❌ ログインページが表示されています');
      throw new Error('Still showing login page');
    }
    console.log('✅ ログイン確認完了！');

    // ─── Step 5: 新規投稿ボタン ───
    console.log('\n➕ Step 5: 新規投稿ボタン...');
    const createBtn = await waitFor(page, [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      '[aria-label="New post"]',
      '[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
    ], '新規投稿ボタン', 30000);

    if (!createBtn) {
      await shot(page, '05-no-create');
      console.log('⚠️  全aria-labels:', labels.join(', '));
      throw new Error('新規投稿ボタンが見つかりません');
    }
    await createBtn.click();
    console.log('✅ New post クリック完了');
    await new Promise(r => setTimeout(r, 3000));
    await shot(page, '05-submenu');

    // サブメニューから「Post」をクリック
    console.log('📋 Post サブメニューをクリック...');
    const postClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, button, [role="menuitem"], [role="button"], span'));
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === 'Post' || txt === '投稿' || txt === 'フォト/動画') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log('Found:', el.tagName, txt);
            el.click();
            return txt;
          }
        }
      }
      return null;
    });

    if (postClicked) {
      console.log(`✅ Post クリック成功: "${postClicked}"`);
    } else {
      const fallback = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('[aria-label*="post" i], [data-type*="post" i]'));
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0) { el.click(); return el.getAttribute('aria-label'); }
        }
        return null;
      });
      if (fallback) {
        console.log(`✅ フォールバッククリック: "${fallback}"`);
      } else {
        console.warn('⚠️  Post ボタンが見つからず（モーダルが直接開いた可能性）');
      }
    }
    await new Promise(r => setTimeout(r, 5000));
    await shot(page, '05-after-post-click');

    // ─── Step 6: 動画アップロード ───
    console.log('📤 Step 6: 動画アップロード...');
    
    let fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.log('📋 Select from computer でファイル選択...');
      try {
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          (async () => {
            const clicked = await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex]'));
              for (const btn of btns) {
                const txt = btn.textContent?.trim() || '';
                if (txt.toLowerCase().includes('select from computer') ||
                    txt.includes('コンピューターから選択') ||
                    txt.includes('Select from')) {
                  btn.click();
                  return true;
                }
              }
              return false;
            });
            if (!clicked) {
              await page.mouse.click(728, 400);
            }
          })()
        ]);
        console.log('✅ FileChooser 取得成功！');
        await fileChooser.accept([videoPath]);
        console.log('✅ ファイル選択完了');
      } catch (fcErr) {
        console.log(`⚠️  FileChooser 失敗: ${fcErr.message}`);
        fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
          await shot(page, '06-no-input');
          throw new Error('ファイル入力なし');
        }
        await fileInput.uploadFile(videoPath);
      }
    } else {
      console.log('✅ ファイル入力発見（DOM内）');
      await fileInput.uploadFile(videoPath);
    }
    console.log('✅ アップロード完了');
    
    // 動画処理を待つ（Instagramは動画を自動的にReelsとして認識）
    console.log('⏳ 動画処理中...');
    await new Promise(r => setTimeout(r, 10000));
    await shot(page, '06-uploaded');

    // ─── Step 7: 次へ × 2 ───
    for (let i = 1; i <= 2; i++) {
      console.log(`⏭️  次へ (${i}/2)...`);
      if (!await clickText(page, ['Next', '次へ', 'Weiter'])) throw new Error(`次へ ${i} なし`);
      await new Promise(r => setTimeout(r, 3000));
    }
    await shot(page, '07-caption');

    // ─── Step 8: キャプション ───
    console.log('📝 Step 8: キャプション...');
    const captionEl = await waitFor(page,
      [
        'div[aria-label*="caption" i][contenteditable="true"]',
        'div[aria-label*="caption" i][contenteditable]',
        'div[contenteditable="true"][role="textbox"]',
        'div[aria-placeholder*="caption" i]',
        'div[aria-placeholder*="Write a caption"]',
      ],
      'captionエリア', 10000
    );
    
    if (captionEl) {
      await captionEl.click();
      await new Promise(r => setTimeout(r, 500));
      await captionEl.type(caption, { delay: 20 });
      console.log('✅ キャプション入力完了');
    } else {
      const typed = await page.evaluate((cap) => {
        const els = Array.from(document.querySelectorAll('[contenteditable="true"]'));
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 30) {
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, cap);
            return true;
          }
        }
        return false;
      }, caption);
      if (typed) { console.log('✅ キャプション入力完了（フォールバック）'); }
      else { console.warn('⚠️  キャプション入力エリアなし（投稿は続行）'); }
    }

    // ─── Step 9: シェア ───
    console.log('🚀 Step 9: 投稿...');
    if (!await clickText(page, ['Share', 'シェア', 'Post'])) {
      await shot(page, '09-no-share');
      throw new Error('シェアボタンなし');
    }
    
    // ─── Step 10: 投稿完了を待機 (60秒タイムアウト) ───
    console.log('⏳ 投稿完了を待機中（最大60秒）...');
    const t0 = Date.now();
    const TIMEOUT = 60000; // 60秒
    
    let completed = false;
    while (Date.now() - t0 < TIMEOUT) {
      // 「Sharing」ダイアログが消えたか確認
      const sharingDialog = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h2, h3, [role="heading"]'));
        return headings.some(h => h.textContent?.trim() === 'Sharing');
      });
      
      if (!sharingDialog) {
        completed = true;
        console.log('✅ 投稿完了！（Sharingダイアログが消えました）');
        break;
      }
      
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`⏳ 投稿処理中... (${elapsed}秒経過)`);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    await shot(page, '10-final');
    
    if (!completed) {
      console.error('❌ タイムアウト: 投稿が60秒以内に完了しませんでした');
      throw new Error('Post did not complete within 60 seconds');
    }

    console.log('\n🎉 Instagram Reels投稿完了！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
