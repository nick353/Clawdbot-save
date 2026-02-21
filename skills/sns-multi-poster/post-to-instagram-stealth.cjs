#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Stealth版 v2
 * 直接ログインページからログイン → 新規投稿
 *
 * 環境変数:
 *   IG_USERNAME: Instagramユーザー名 (デフォルト: nisen_prints)
 *   IG_PASSWORD: Instagramパスワード (必須)
 *
 * Usage: node post-to-instagram-stealth.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const imagePath = process.argv[2];
const caption = process.argv[3];
const IG_USERNAME = process.env.IG_USERNAME || 'nisen_prints';
const IG_PASSWORD = process.env.IG_PASSWORD;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-stealth.cjs <image_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}
if (!IG_PASSWORD) {
  console.error('❌ IG_PASSWORD 環境変数が設定されていません');
  process.exit(1);
}

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-stealth-${label}-${ts}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${label}: ${p}`);
  return p;
}

async function waitFor(page, selectors, desc, timeout = 30000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
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
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error(`❌ タイムアウト: ${desc}`);
  return null;
}

async function clickText(page, texts, timeout = 15000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const result = await page.evaluate(ts => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const txt = el.innerText?.trim().toLowerCase();
        if (ts.some(t => txt?.includes(t.toLowerCase()))) {
          el.click();
          return txt;
        }
      }
      return null;
    }, texts);
    if (result) { console.log(`✅ クリック: "${result}"`); return true; }
    await new Promise(r => setTimeout(r, 800));
  }
  return false;
}

async function typeIntoField(page, selector, value) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await el.press('Backspace');
  // 1文字ずつ確実に入力
  for (const ch of value) {
    await page.keyboard.type(ch, { delay: 80 });
  }
  return true;
}

async function postToInstagram() {
  console.log('📸 Instagram 投稿開始（Stealth v2）...');
  console.log(`👤 ユーザー: ${IG_USERNAME}`);
  console.log(`🖼️  画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}...`);

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

    // ─── Step 1: 直接ログインページへ ───
    console.log('\n🔐 Step 1: ログインページにアクセス...');
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2', timeout: 60000
    });
    await new Promise(r => setTimeout(r, 5000));
    await shot(page, '01-login-page');

    // ─── Step 2: ユーザー名入力 ───
    console.log('👤 Step 2: ユーザー名入力...');
    const usernameInput = await waitFor(
      page,
      ['input[name="username"]', 'input[aria-label*="username"]', 'input[aria-label*="ユーザー"]'],
      'ユーザー名入力欄', 20000
    );
    if (!usernameInput) {
      await shot(page, '02-no-username');
      throw new Error('ユーザー名入力欄が見つかりません');
    }
    await typeIntoField(page, 'input[name="username"]', IG_USERNAME);
    console.log('✅ ユーザー名入力完了');

    // ─── Step 3: パスワード入力 ───
    console.log('🔑 Step 3: パスワード入力...');
    const passwordInput = await waitFor(
      page,
      ['input[name="password"]', 'input[type="password"]'],
      'パスワード入力欄', 10000
    );
    if (!passwordInput) {
      await shot(page, '03-no-password');
      throw new Error('パスワード入力欄が見つかりません');
    }
    await typeIntoField(page, 'input[name="password"]', IG_PASSWORD);
    console.log('✅ パスワード入力完了');
    await shot(page, '03-before-login');

    // ─── Step 4: ログインボタンクリック ───
    console.log('🖱️  Step 4: ログインボタンクリック...');
    const loginOk = await clickText(page, ['Log in', 'ログイン', 'Sign in']);
    if (!loginOk) {
      await page.keyboard.press('Enter');
      console.log('✅ Enter で送信');
    }
    console.log('⏳ ログイン処理待機 (20秒)...');
    await new Promise(r => setTimeout(r, 20000));
    await shot(page, '04-after-login');

    // ─── Step 5: ログイン確認 ───
    console.log('🔍 Step 5: ログイン確認...');
    const afterUrl = page.url();
    const afterContent = await page.content();
    console.log(`📍 現在URL: ${afterUrl}`);

    if (afterContent.includes('incorrect') || afterContent.includes('不正') ||
        afterContent.includes('wrong') || afterContent.includes('パスワードが違')) {
      throw new Error('パスワードが間違っています');
    }
    if (afterUrl.includes('/accounts/login') || afterUrl.includes('/challenge')) {
      const ariaLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-label]'))
          .map(e => e.getAttribute('aria-label')).filter(Boolean)
      );
      console.log('⚠️  ページ aria-labels:', ariaLabels.slice(0, 20).join(', '));
      if (afterUrl.includes('/challenge')) {
        throw new Error('2段階認証または本人確認が必要です');
      }
      throw new Error('ログインに失敗しました');
    }

    // Cookie 保存
    const newCookies = await page.cookies('https://www.instagram.com');
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    fs.writeFileSync(cookiesPath, JSON.stringify(newCookies, null, 2));
    console.log(`✅ Cookie保存 (${newCookies.length}件)`);
    console.log('✅ ログイン成功！');

    // 通知ポップアップを閉じる
    await clickText(page, ['Not now', '今はしない', 'あとで'], 5000).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // ─── Step 6: 新規投稿ボタン ───
    console.log('\n➕ Step 6: 新規投稿ボタンを探しています...');
    const createButton = await waitFor(page, [
      'svg[aria-label="New post"]',
      'svg[aria-label="新規投稿"]',
      'svg[aria-label="Create"]',
      '[aria-label="New post"]',
      '[aria-label="新規投稿"]',
    ], '新規投稿ボタン', 30000);

    if (!createButton) {
      await shot(page, '06-no-create-button');
      const labels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-label]'))
          .map(e => e.getAttribute('aria-label')).filter(Boolean).slice(0, 30)
      );
      console.log('⚠️  aria-labels:', labels.join(', '));
      throw new Error('新規投稿ボタンが見つかりません');
    }
    await createButton.click();
    console.log('✅ 新規投稿ボタンクリック');
    await new Promise(r => setTimeout(r, 5000));
    await shot(page, '06-after-create-click');

    // ─── Step 7: ファイルアップロード ───
    console.log('📤 Step 7: 画像アップロード...');
    const fileInput = await waitFor(page,
      ['input[type="file"]', '[role="dialog"] input[type="file"]'],
      'ファイル入力', 20000
    );
    if (!fileInput) {
      await shot(page, '07-no-file-input');
      throw new Error('ファイル入力が見つかりません');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    await new Promise(r => setTimeout(r, 5000));
    await shot(page, '07-after-upload');

    // ─── Step 8: 次へ × 2 ───
    for (let i = 1; i <= 2; i++) {
      console.log(`⏭️  Step 8-${i}: 次へボタン...`);
      const ok = await clickText(page, ['Next', '次へ', 'Weiter']);
      if (!ok) throw new Error(`次へボタン ${i} が見つかりません`);
      await new Promise(r => setTimeout(r, 3000));
    }
    await shot(page, '08-caption-screen');

    // ─── Step 9: キャプション ───
    console.log('📝 Step 9: キャプション入力...');
    const textarea = await waitFor(page,
      ['textarea[aria-label*="caption"]', 'textarea[aria-label*="キャプション"]', 'textarea'],
      'キャプション入力欄', 10000
    );
    if (textarea) {
      await textarea.click();
      await textarea.type(caption, { delay: 30 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力欄が見つかりませんでした');
    }
    await new Promise(r => setTimeout(r, 2000));

    // ─── Step 10: シェア ───
    console.log('🚀 Step 10: 投稿（シェア）...');
    const shared = await clickText(page, ['Share', 'シェア', 'Teilen', 'Post']);
    if (!shared) {
      await shot(page, '10-no-share');
      throw new Error('シェアボタンが見つかりません');
    }
    console.log('⏳ 投稿完了待機 (15秒)...');
    await new Promise(r => setTimeout(r, 15000));
    await shot(page, '10-done');
    console.log('\n🎉 Instagram 投稿完了！');

  } finally {
    await browser.close();
  }
}

postToInstagram()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ 失敗:', err.message);
    process.exit(1);
  });
