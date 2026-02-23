#!/usr/bin/env node
/**
 * 解決策1: waitUntil='domcontentloaded' に変更
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');

async function main() {
  console.log('🧪 解決策1: waitUntil=domcontentloaded');
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
    page.setDefaultTimeout(15000); // 15秒に短縮

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie数: ${cookies.length}`);

    console.log('🌐 Threads にアクセスしています...');
    const start = Date.now();
    
    // domcontentloaded に変更 → ページの基本構造が読み込まれたら即座に進む
    await page.goto('https://www.threads.net/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    
    const loadTime = Date.now() - start;
    console.log(`✅ ページ読み込み完了: ${loadTime}ms`);

    await page.waitForTimeout(2000);

    const screenshot = '/tmp/threads-solution1.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`📸 スクリーンショット: ${screenshot}`);

    const currentUrl = page.url();
    console.log(`📍 現在のURL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('❌ ログインページにリダイレクト');
    } else {
      console.log('✅ ログイン成功！');
      console.log('');
      console.log('🎯 解決策1は有効です');
    }

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    await browser.close();
    process.exit(1);
  }
}

main();
