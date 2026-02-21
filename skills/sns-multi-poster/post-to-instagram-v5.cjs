#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト v5
 * Cookie JSONファイルから直接セッション復元 → 投稿
 * ログインページを一切使わない
 *
 * Usage: node post-to-instagram-v5.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v5.cjs <image_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-v5-${label}-${ts}.png`;
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
    console.log('🔄 DRY RUN: Instagram投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  console.log('📸 Instagram 投稿開始 (v5 - Cookie直接セッション版)');
  console.log(`🖼️  ${imagePath}`);
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

    // タイムアウトを長めに設定（Instagram は重い）
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // ─── Step 1: Cookie事前セット（ドメインなしで設定可能） ───
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
    
    // JS追加読み込みを待つ
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

    // サブメニューから「Post」をクリック（a要素も含めて検索）
    console.log('📋 Post サブメニューをクリック...');
    const postClicked = await page.evaluate(() => {
      // すべての要素を検索（button, a, div, span）
      const all = Array.from(document.querySelectorAll('a, button, [role="menuitem"], [role="button"], span'));
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === 'Post' || txt === '投稿' || txt === 'フォト/動画') {
          // 可視チェック
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
      // フォールバック: aria-label や data-type で探す
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

    // ─── Step 6: ファイルアップロード ───
    console.log('📤 Step 6: 画像アップロード...');
    
    // まず input[type="file"] が既にDOMにあるか確認（隠れていてもOK）
    let fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      // モーダルの「Select from computer」クリックで file chooser を処理
      console.log('📋 Select from computer でファイル選択...');
      try {
        // waitForFileChooser は Promise.all でclickと同時に実行
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          (async () => {
            // 「Select from computer」ボタンを探してクリック
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
              // フォールバック: ページ全体をクリック（ドロップゾーン）
              await page.mouse.click(728, 400);
            }
          })()
        ]);
        console.log('✅ FileChooser 取得成功！');
        await fileChooser.accept([imagePath]);
        console.log('✅ ファイル選択完了');
      } catch (fcErr) {
        console.log(`⚠️  FileChooser 失敗: ${fcErr.message}`);
        // 最終フォールバック: inputを直接探す
        fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
          await shot(page, '06-no-input');
          throw new Error('ファイル入力なし');
        }
        await fileInput.uploadFile(imagePath);
      }
    } else {
      console.log('✅ ファイル入力発見（DOM内）');
      await fileInput.uploadFile(imagePath);
    }
    console.log('✅ アップロード完了');
    await new Promise(r => setTimeout(r, 5000));
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
    // Instagramのキャプション入力はcontenteditable divを使用
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
      // フォールバック: contenteditable要素を総当たり
      const typed = await page.evaluate((cap) => {
        const els = Array.from(document.querySelectorAll('[contenteditable="true"]'));
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 30) {
            el.focus();
            // 既存テキストをクリアしてから入力
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
    console.log('⏳ 完了待機 (15秒)...');
    await new Promise(r => setTimeout(r, 15000));
    await shot(page, '09-done');

    console.log('\n🎉 Instagram投稿完了！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
