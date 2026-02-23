#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト v6 - BAN対策完全版
 * Level 1 + Level 2 統合:
 * - レート制限（3投稿/時間、20投稿/日）
 * - 投稿時間制限（7時〜23時のみ）
 * - ランダム遅延（人間らしい操作）
 * - User-Agentローテーション
 * - puppeteer-extra + stealth plugin
 * - Chrome Detection 回避
 *
 * Usage: node post-to-instagram-v6-anti-ban.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const {
  checkRateLimit,
  logPost,
  isAllowedPostingTime,
  randomDelay,
  getRandomUserAgent,
  bypassChromeDetection,
  config,
} = require('./lib/anti-ban-helpers.js');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v6-anti-ban.cjs <image_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-v6-${label}-${ts}.png`;
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
  // ===== BAN対策 Level 1: 事前チェック =====
  console.log('🛡️  BAN対策チェック開始...');

  // 1. DRY RUN チェック
  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Instagram投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  // 2. 投稿時間チェック（7時〜23時のみ）
  if (!isAllowedPostingTime()) {
    console.error('❌ 投稿禁止時間帯です（7時〜23時のみ許可）');
    console.error('   深夜投稿はBOT検出リスクが高いため禁止されています');
    process.exit(1);
  }
  console.log('✅ 投稿時間OK');

  // 3. レート制限チェック（3投稿/時間、20投稿/日）
  if (!(await checkRateLimit('instagram'))) {
    console.error('❌ レート制限超過（Instagram: 3投稿/時間、20投稿/日）');
    console.error('   時間を空けてから再度お試しください');
    process.exit(1);
  }
  console.log('✅ レート制限OK');

  console.log('🛡️  BAN対策チェック完了！\n');

  // ===== 投稿処理開始 =====
  console.log('📸 Instagram 投稿開始 (v6 - BAN対策完全版)');
  console.log(`🖼️  ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);

  // ランダムUser-Agent取得
  const userAgent = getRandomUserAgent();
  console.log(`🎭 User-Agent: ${userAgent.substring(0, 50)}...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: config.browserArgs,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(userAgent);

    // BAN対策: Chrome Detection 回避
    await bypassChromeDetection(page);

    // BAN対策: Timezone設定（日本時間）
    await page.emulateTimezone('Asia/Tokyo');

    // BAN対策: 言語設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // タイムアウトを長めに設定
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

    // BAN対策: ランダム遅延（2〜5秒）
    await randomDelay(2000, 5000);

    // ─── Step 2: Instagram.com に直接ナビゲート ───
    console.log('🌐 Step 2: Instagram に移動中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
    console.log('✅ ページ読み込み完了');
    
    // BAN対策: ランダム遅延（JS追加読み込み待ち）
    await randomDelay(8000, 12000);
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

    // BAN対策: ランダム遅延
    await randomDelay(1000, 3000);

    // ─── Step 5: 新規投稿ボタン ───
    console.log('\n➕ Step 5: 新規投稿ボタン...');
    const createBtn = await waitFor(page, [
      'svg[aria-label="New post"]',
      'svg[aria-label="新しい投稿"]',
      '[aria-label="新しい投稿"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="新しい投稿"]',
      '[aria-label="新しい投稿"]',
      '[aria-label="New post"]',
      '[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
    ], '新規投稿ボタン', 30000);

    if (!createBtn) {
      await shot(page, '05-no-create');
      throw new Error('新規投稿ボタンが見つかりません');
    }

    // BAN対策: ランダム遅延（クリック前）
    await randomDelay(500, 1500);
    await createBtn.click();
    console.log('✅ New post クリック完了');
    
    // BAN対策: ランダム遅延（クリック後）
    await randomDelay(2000, 4000);
    await shot(page, '05-submenu');

    // サブメニューから「Post」をクリック
    console.log('📋 Post サブメニューをクリック...');
    
    // BAN対策: ランダム遅延
    await randomDelay(500, 1500);
    
    const postClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, button, [role="menuitem"], [role="button"], span'));
      for (const el of all) {
        const txt = el.textContent?.trim();
        if (txt === 'Post' || txt === '投稿' || txt === 'フォト/動画') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
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
      console.warn('⚠️  Post ボタンが見つからず（モーダルが直接開いた可能性）');
    }
    
    // BAN対策: ランダム遅延
    await randomDelay(4000, 6000);
    await shot(page, '05-after-post-click');

    // ─── Step 6: ファイルアップロード ───
    console.log('📤 Step 6: 画像アップロード...');
    
    let fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.log('📋 Select from computer でファイル選択...');
      try {
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          (async () => {
            // BAN対策: ランダム遅延
            await randomDelay(500, 1000);
            
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
        await fileChooser.accept([imagePath]);
        console.log('✅ ファイル選択完了');
      } catch (fcErr) {
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
    
    // BAN対策: ランダム遅延（アップロード後）
    await randomDelay(4000, 7000);
    await shot(page, '06-uploaded');

    // ─── Step 7: 次へ（最大3回、キャプション画面まで） ───
    for (let i = 1; i <= 3; i++) {
      console.log(`⏭️  次へ (${i}/3)...`);
      
      // キャプション入力欄が既にあれば終了
      const captionCheck = await page.$('div[contenteditable]').catch(() => null);
      if (captionCheck) {
        console.log('✅ キャプション画面に到達');
        break;
      }
      
      // BAN対策: ランダム遅延（クリック前）
      await randomDelay(1500, 2500);
      
      const clicked = await clickText(page, ['Next', '次へ', 'Weiter']);
      if (!clicked) {
        if (i >= 2) {
          console.log(`⚠️ 次へ ${i} なし（スキップ）`);
          break;
        }
        throw new Error(`次へ ${i} なし`);
      }
      
      // BAN対策: ランダム遅延（クリック後）
      await randomDelay(2500, 4000);
    }
    await shot(page, '07-caption');

    // ─── Step 8: キャプション（人間らしいタイピング） ───
    console.log('📝 Step 8: キャプション...');
    
    // BAN対策: ランダム遅延
    await randomDelay(1000, 2000);
    
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
      await randomDelay(500, 1000);
      
      // BAN対策: 人間らしいタイピング（文字ごとにランダム遅延）
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150); // 50〜150msのランダム遅延
      }
      console.log('✅ キャプション入力完了（人間らしいタイピング）');
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

    // BAN対策: ランダム遅延（投稿前）
    await randomDelay(2000, 4000);

    // ─── Step 9: シェア ───
    console.log('🚀 Step 9: 投稿...');
    if (!await clickText(page, ['Share', 'シェア', 'Post'])) {
      await shot(page, '09-no-share');
      throw new Error('シェアボタンなし');
    }
    console.log('⏳ 完了待機 (15秒)...');
    await randomDelay(12000, 18000); // 12〜18秒のランダム待機
    await shot(page, '09-done');

    // ===== BAN対策: 投稿ログ記録 =====
    await logPost('instagram');
    console.log('📊 投稿ログ記録完了');

    console.log('\n🎉 Instagram投稿完了（BAN対策完全版）！');

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
