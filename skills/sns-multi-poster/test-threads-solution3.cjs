#!/usr/bin/env node
/**
 * 解決策3: タイムアウト短縮 + リトライ
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');
const MAX_RETRIES = 2;
const TIMEOUT = 10000; // 10秒に短縮

async function tryLogin(browser, attempt) {
  console.log(`🔄 試行 ${attempt}/${MAX_RETRIES}...`);

  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);

  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await page.setCookie(...cookies);

    console.log('🌐 Threads にアクセスしています...');
    const start = Date.now();

    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });

    const loadTime = Date.now() - start;
    console.log(`✅ ページ読み込み完了: ${loadTime}ms`);

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      throw new Error('ログインページにリダイレクトされました');
    }

    console.log('✅ ログイン成功！');
    await page.close();
    return true;
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    await page.close();
    return false;
  }
}

async function main() {
  console.log('🧪 解決策3: タイムアウト短縮 + リトライ');
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
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const success = await tryLogin(browser, attempt);

      if (success) {
        console.log('');
        console.log('🎯 解決策3は有効です');
        await browser.close();
        process.exit(0);
      }

      if (attempt < MAX_RETRIES) {
        console.log('⏳ 5秒待機してリトライ...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('');
    console.log('❌ 全ての試行が失敗しました');
    await browser.close();
    process.exit(1);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    await browser.close();
    process.exit(1);
  }
}

main();
