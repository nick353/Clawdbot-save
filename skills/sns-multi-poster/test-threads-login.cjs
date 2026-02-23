#!/usr/bin/env node
/**
 * Threads ログイン状態確認スクリプト
 * 投稿はせず、ログインできているか確認する
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join('/root/clawd/skills/sns-multi-poster/cookies/threads.json');

async function main() {
  console.log('🧵 Threads ログイン状態確認...');
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // クッキー読み込み
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie数: ${cookies.length}`);

    // Threads にアクセス
    console.log('🌐 Threads にアクセスしています...');
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForTimeout(3000);

    // スクリーンショット撮影
    const screenshot = '/tmp/threads-login-test.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`📸 スクリーンショット: ${screenshot}`);

    // URLをチェック
    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);

    // ログイン状態を判定
    if (currentUrl.includes('/login')) {
      console.log('');
      console.log('❌ ログインページにリダイレクトされました');
      console.log('   → Cookie が無効です');
    } else {
      console.log('');
      console.log('✅ ログイン成功！');
      console.log('   → Cookie は有効です');
    }

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
