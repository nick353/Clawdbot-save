#!/usr/bin/env node
/**
 * Facebook ブラウザプロファイル初期化スクリプト
 * Cookie → Playwright storageState 変換 + ログイン確認
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/facebook';
const COOKIE_PATH = '/root/clawd/skills/sns-multi-poster/cookies/facebook.json';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const OUTPUT_COOKIE_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('');
  console.log('='.repeat(50));
  console.log('📘 Facebook ブラウザプロファイル初期化');
  console.log('='.repeat(50));
  console.log('');

  // プロファイルディレクトリ作成
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  // Cookie読み込み
  console.log('📂 Cookie読み込み中...');
  if (!fs.existsSync(COOKIE_PATH)) {
    console.error(`❌ Cookie が見つかりません: ${COOKIE_PATH}`);
    process.exit(1);
  }

  const cookieData = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
  console.log(`✅ Cookie数: ${cookieData.length}`);

  // Playwright Cookie形式に変換
  const cookies = cookieData.map(c => {
    let sameSite = c.sameSite || 'Lax';
    if (sameSite === 'no_restriction') sameSite = 'None';
    if (!['Strict', 'Lax', 'None'].includes(sameSite)) sameSite = 'Lax';
    
    return {
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      expires: c.expirationDate ? c.expirationDate : -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite,
    };
  });

  // ブラウザ起動
  console.log('🚀 ブラウザを起動しています...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  });

  // Cookie追加
  await context.addCookies(cookies);

  const page = await context.newPage();

  // Facebookにアクセス
  console.log('');
  console.log('🌐 Facebook にアクセスしています...');
  const startTime = Date.now();
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const loadTime = Date.now() - startTime;
  console.log(`✅ ページ読み込み完了: ${loadTime}ms`);

  // スクリーンショット
  await page.screenshot({ path: '/tmp/facebook-profile-init.png', fullPage: false });
  console.log('📸 スクリーンショット: /tmp/facebook-profile-init.png');

  // URL確認
  const currentUrl = page.url();
  console.log(`📍 現在のURL: ${currentUrl}`);

  if (currentUrl.includes('facebook.com') && !currentUrl.includes('login')) {
    console.log('✅ ログイン確認成功');
  } else {
    console.log('⚠️  ログインページにリダイレクトされました');
    console.log('   Cookie の有効期限が切れている可能性があります');
  }

  // storageState保存
  console.log('');
  console.log('💾 ブラウザプロファイルを保存しています...');
  const storageState = await context.storageState();
  fs.writeFileSync(STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log(`✅ storageState保存: ${STATE_PATH}`);

  // Cookie保存
  const contextCookies = await context.cookies();
  fs.writeFileSync(OUTPUT_COOKIE_PATH, JSON.stringify(contextCookies, null, 2));
  console.log(`✅ クッキー保存: ${OUTPUT_COOKIE_PATH}`);

  await browser.close();

  console.log('');
  console.log('='.repeat(50));
  console.log('✅ ブラウザプロファイル初期化完了！');
  console.log('='.repeat(50));
  console.log('');
  console.log('次のコマンドで投稿できます:');
  console.log('node post-to-facebook-playwright.cjs "テキスト" [画像パス]');
  console.log('');
}

main().catch((err) => {
  console.error('❌ エラーが発生しました:', err.message);
  process.exit(1);
});
