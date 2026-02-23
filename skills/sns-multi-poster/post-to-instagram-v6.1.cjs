#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト v6.1
 * v6-improved + VPS最適化設定
 * 
 * 改善点:
 * - VPS Puppeteer最適化設定を統合
 * - 30秒タイムアウト適用
 * - DNS最適化を活用
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
} = require('./lib/anti-ban-helpers.js');

puppeteer.use(StealthPlugin());

const [, , imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v6.1.cjs <image_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const VPS_CONFIG = {
  navigationTimeout: 30000,
  defaultTimeout: 30000,
  networkTimeout: 30000,
};

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-61-${label}-${ts}.png`;
  await page.screenshot({ path: p, fullPage: true }).catch(() => null);
  if (fs.existsSync(p)) console.log(`📸 ${label} - ${Math.floor(fs.statSync(p).size / 1024)}KB`);
  return p;
}

async function clickText(page, texts, timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await page.evaluate(ts => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        if (ts.some(t => el.innerText?.trim().toLowerCase().includes(t.toLowerCase()))) {
          try {
            el.click();
            return el.innerText.trim();
          } catch (e) { /* retry */ }
        }
      }
      return null;
    });
    if (r) return r;
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  return null;
}

async function main() {
  console.log('📸 Instagram v6.1 (VPS最適化)');
  
  // BAN対策チェック
  if (!isAllowedPostingTime()) process.exit(1);
  if (!(await checkRateLimit('instagram'))) process.exit(1);

  // VPS最適化設定を適用
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--single-process',
      '--disable-web-resources',
      '--disable-sync',
      '--disable-extensions',
      '--disable-default-apps',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    timeout: VPS_CONFIG.navigationTimeout,
    protocolTimeout: VPS_CONFIG.navigationTimeout,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(VPS_CONFIG.defaultTimeout);
    page.setDefaultNavigationTimeout(VPS_CONFIG.navigationTimeout);

    console.log(`⏱️  タイムアウト設定: ${VPS_CONFIG.defaultTimeout}ms`);

    // Cookie設定
    console.log('🔐 Cookie読み込み...');
    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error(`Cookie見つかりません: ${COOKIES_PATH}`);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // Instagram へアクセス
    console.log('🌐 Instagram にアクセス...');
    const startTime = Date.now();
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: VPS_CONFIG.navigationTimeout 
    });
    const loadTime = Date.now() - startTime;
    console.log(`✅ ロード完了 (${loadTime}ms)`);
    await shot(page, '01-loaded');

    // ログイン確認
    const loggedIn = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label'));
      return labels.some(l => l?.includes('ホーム') || l?.includes('Home'));
    });
    if (!loggedIn) throw new Error('ログイン失敗');
    console.log('✅ ログイン確認');

    // 新規投稿ボタン
    console.log('➕ 新規投稿...');
    const newPost = await clickText(page, ['新しい投稿', 'New post', 'Create']);
    if (!newPost) throw new Error('新規投稿ボタンが見つかりません');
    await randomDelay(2000, 3000);

    // Post メニュー
    const postMenu = await clickText(page, ['Post', '投稿']);
    console.log(`✅ メニュー選択: ${postMenu}`);
    await randomDelay(3000, 4000);
    await shot(page, '02-menu');

    // ファイルアップロード
    console.log('📤 ファイルアップロード...');
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('ファイル入力が見つかりません');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ アップロード完了');
    await randomDelay(4000, 6000);
    await shot(page, '03-uploaded');

    // 次へ (max 3回)
    for (let i = 1; i <= 3; i++) {
      const captionCheck = await page.$('div[contenteditable="true"]').catch(() => null);
      if (captionCheck) {
        console.log('✅ キャプション画面に到達');
        break;
      }
      console.log(`⏭️  次へ (${i}/3)...`);
      await randomDelay(1500, 2500);
      const clicked = await clickText(page, ['Next', '次へ']);
      if (!clicked && i >= 2) break;
      await randomDelay(2500, 4000);
    }
    await shot(page, '04-caption-ready');

    // キャプション入力
    console.log('✍️  キャプション入力...');
    const captionEl = await page.$('div[contenteditable="true"]').catch(() => null);
    if (captionEl) {
      await captionEl.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力エリアなし（スキップ）');
    }
    await randomDelay(2000, 3000);
    await shot(page, '05-caption-done');

    // 投稿（リトライロジック付き）
    console.log('🚀 投稿処理...');
    let posted = false;
    for (let retry = 0; retry < 2; retry++) {
      try {
        console.log(`${retry === 0 ? '初回' : 'リトライ'} 投稿ボタン検索...`);
        await randomDelay(1000, 2000);
        
        const shareClicked = await clickText(page, ['Share', 'シェア', '投稿']);
        if (!shareClicked) {
          await shot(page, `06-no-share-r${retry}`);
          if (retry === 0) {
            console.warn('⚠️  投稿ボタン見つからず。リトライ...');
            await randomDelay(2000, 3000);
            continue;
          } else {
            throw new Error('投稿ボタンが見つかりません');
          }
        }
        console.log(`✅ 投稿ボタンクリック: ${shareClicked}`);
        
        // 投稿完了待機
        console.log('⏳ 投稿完了待機 (15秒)...');
        await randomDelay(13000, 17000);
        
        // エラーダイアログ検出
        const hasError = await page.evaluate(() => {
          const errorTexts = ['エラーが発生', 'Something went wrong', 'Error'];
          return Array.from(document.querySelectorAll('*')).some(el =>
            errorTexts.some(text => el.textContent?.includes(text))
          );
        });
        
        if (hasError) {
          console.warn('⚠️  エラーダイアログを検出。リトライ...');
          const retried = await clickText(page, ['もう一度実行', 'Try again', 'Retry']);
          if (retried) {
            console.log('🔄 リトライボタンをクリック');
            await randomDelay(3000, 5000);
            continue;
          } else if (retry === 0) {
            await randomDelay(5000, 8000);
            continue;
          } else {
            throw new Error('投稿エラー（リトライ上限）');
          }
        }
        
        posted = true;
        console.log('✅ 投稿完了！');
        break;
      } catch (err) {
        if (retry === 0) {
          console.warn(`⚠️  エラー: ${err.message}。リトライ...`);
          await randomDelay(3000, 5000);
        } else {
          throw err;
        }
      }
    }

    if (!posted) {
      throw new Error('投稿に失敗しました');
    }

    await shot(page, '07-success');

    // 投稿ログ
    await logPost('instagram');
    console.log('\n🎉 Instagram 投稿完了！');

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
