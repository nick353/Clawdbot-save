#!/usr/bin/env node
/**
 * Instagram v6.4-debug
 * セレクタをDebugログ付きで確認
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [, , imagePath, caption] = process.argv;
const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function main() {
  console.log('🔍 Instagram DOM Debug');
  
  const browser = await puppeteer.launch({
    headless: 'new',
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

    // Cookie設定
    console.log('🔐 Cookie読み込み...');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie: ${cookies.length}件`);

    // Instagram へアクセス
    console.log('🌐 Instagram にアクセス...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    console.log('✅ ロード完了');

    // ログイン確認
    const loggedIn = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label'));
      return labels.some(l => l?.includes('ホーム') || l?.includes('Home'));
    });
    console.log(`✅ ログイン: ${loggedIn}`);

    // DOM構造をDebugする
    const domInfo = await page.evaluate(() => {
      console.log('=== NAV Links ===');
      const navLinks = document.querySelectorAll('nav a, nav button, nav [role="button"]');
      console.log(`nav要素の子: ${navLinks.length}`);
      
      Array.from(navLinks).forEach((el, i) => {
        const label = el.getAttribute('aria-label') || el.innerText || '(no text)';
        const href = el.href || el.getAttribute('href') || '(no href)';
        console.log(`[${i}] aria-label="${label}" href="${href}"`);
      });

      // aria-label="Create"を探す
      console.log('\n=== Create ボタン検索 ===');
      const createBtn = document.querySelector('[aria-label="Create"]');
      if (createBtn) {
        console.log('✅ Found: [aria-label="Create"]');
      } else {
        console.log('❌ Not found: [aria-label="Create"]');
      }

      // 新規投稿関連のセレクタ
      console.log('\n=== Create関連セレクタ ===');
      const possibleSelectors = [
        'a[href="#"]',
        'a[href="/create/"]',
        '[aria-label*="create" i]',
        '[aria-label*="Create" i]',
        'svg[aria-label*="create" i]',
      ];

      possibleSelectors.forEach(sel => {
        const count = document.querySelectorAll(sel).length;
        console.log(`${sel}: ${count}件`);
      });

      // 左サイドバー確認
      console.log('\n=== サイドバー ===');
      const sidebar = document.querySelector('nav');
      if (sidebar) {
        console.log('✅ nav found');
        console.log(`内部HTML長: ${sidebar.innerHTML.length}`);
        console.log(`子要素数: ${sidebar.children.length}`);
      } else {
        console.log('❌ nav not found');
      }

      return 'debug-complete';
    });

    console.log('\n✅ DOM分析完了');

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
}

main();
