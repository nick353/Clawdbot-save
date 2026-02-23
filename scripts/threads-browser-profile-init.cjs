#!/usr/bin/env node
/**
 * Threads ブラウザプロファイル初期化スクリプト
 * 既存のcookies/threads.jsonからブラウザプロファイルを作成
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_OUT = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🔧 Threads ブラウザプロファイル初期化');
  console.log('');

  // クッキーを読み込み
  if (!fs.existsSync(COOKIES_PATH)) {
    console.error(`❌ クッキーファイルが見つかりません: ${COOKIES_PATH}`);
    process.exit(1);
  }

  const puppeteerCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
  console.log(`✅ Puppeteer Cookie数: ${puppeteerCookies.length}`);

  // Playwright形式に変換
  const playwrightCookies = puppeteerCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : 
              c.sameSite === 'lax' ? 'Lax' : 
              c.sameSite === 'strict' ? 'Strict' : 'None',
  }));

  console.log('🚀 Playwright ブラウザ起動...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    // クッキーを設定
    await context.addCookies(playwrightCookies);
    console.log('✅ クッキーを設定しました');

    // Threadsにアクセスしてセッションを確認
    const page = await context.newPage();
    console.log('🌐 Threads にアクセスしています...');
    await page.goto('https://www.threads.net/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.error('❌ ログインページにリダイレクトされました');
      console.error('   Cookie が無効です');
      process.exit(1);
    }

    console.log('✅ ログイン確認成功');

    // ブラウザプロファイルを保存
    console.log('');
    console.log('💾 ブラウザプロファイルを保存しています...');
    fs.mkdirSync(PROFILE_DIR, { recursive: true });

    const state = await context.storageState();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    console.log(`✅ storageState保存: ${STATE_PATH}`);

    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_OUT, JSON.stringify(cookies, null, 2));
    console.log(`✅ クッキー保存: ${COOKIES_OUT}`);

    console.log('');
    console.log('='.repeat(50));
    console.log('✅ ブラウザプロファイル初期化完了！');
    console.log('='.repeat(50));
    console.log('');
    console.log('次のコマンドで投稿できます:');
    console.log('  node post-to-threads-playwright.cjs "テキスト" [画像パス]');

    await context.close();
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    await browser.close();
    process.exit(1);
  }
}

main();
