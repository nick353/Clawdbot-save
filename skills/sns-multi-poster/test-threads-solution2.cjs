#!/usr/bin/env node
/**
 * 解決策2: Playwright版テスト（DRY RUN）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🧪 解決策2: Playwright版テスト');
  console.log('');

  if (!fs.existsSync(STATE_PATH)) {
    console.error('❌ ブラウザプロファイルが見つかりません');
    console.error('   初期化スクリプトを実行してください:');
    console.error('   node /root/clawd/scripts/threads-browser-profile-init.cjs');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  try {
    console.log('📂 ブラウザプロファイルを読み込んでいます...');
    const context = await browser.newContext({
      storageState: STATE_PATH,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);
    console.log(`✅ Cookie数: ${cookies.length}`);

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    console.log('🌐 Threads にアクセスしています...');
    const start = Date.now();
    await page.goto('https://www.threads.net/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    const loadTime = Date.now() - start;
    console.log(`✅ ページ読み込み完了: ${loadTime}ms`);

    await page.waitForTimeout(2000);

    const screenshot = '/tmp/threads-solution2.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`📸 スクリーンショット: ${screenshot}`);

    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('❌ ログインページにリダイレクト');
    } else {
      console.log('✅ ログイン成功！');
      console.log('');
      console.log('🎯 解決策2は有効です');
      console.log('   （DRY RUN: 実際の投稿はスキップ）');
    }

    await context.close();
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    await browser.close();
    process.exit(1);
  }
}

main();
