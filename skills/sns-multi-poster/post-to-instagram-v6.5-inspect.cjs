#!/usr/bin/env node
/**
 * Instagram v6.5-inspect
 * HTMLを取得してDOM構造を確認
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function main() {
  console.log('🔍 Instagram DOM Inspector');
  
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

    // Cookie
    console.log('🔐 Cookie読み込み...');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);

    // Load
    console.log('🌐 Instagram にアクセス...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    console.log('✅ ロード完了');

    // DOMを取得
    const domData = await page.evaluate(() => {
      return {
        navCount: document.querySelectorAll('nav').length,
        navLinksCount: document.querySelectorAll('nav a').length,
        createByAriaLabel: !!document.querySelector('[aria-label="Create"]'),
        createByAriaLabelCI: document.querySelectorAll('[aria-label*="create" i]').length,
        allNavHTML: document.querySelector('nav')?.outerHTML?.substring(0, 2000) || 'no nav',
      };
    });

    console.log('\n📊 DOM Statistics:');
    console.log(`nav要素: ${domData.navCount}`);
    console.log(`nav > a: ${domData.navLinksCount}`);
    console.log(`[aria-label="Create"]: ${domData.createByAriaLabel}`);
    console.log(`[aria-label*="create" i]: ${domData.createByAriaLabelCI}`);

    // navのHTMLをファイルに保存
    if (domData.allNavHTML && domData.allNavHTML !== 'no nav') {
      fs.writeFileSync('/tmp/instagram-nav.html', domData.allNavHTML);
      console.log('\n✅ nav HTML -> /tmp/instagram-nav.html');
    }

    // Full pageのHTMLを保存
    const fullHTML = await page.content();
    const sidebarSection = fullHTML.match(/<nav[^>]*>[\s\S]*?<\/nav>/)?.[0] || '';
    if (sidebarSection) {
      fs.writeFileSync('/tmp/instagram-sidebar-full.html', sidebarSection);
      console.log('✅ sidebar HTML -> /tmp/instagram-sidebar-full.html');
    }

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
}

main();
