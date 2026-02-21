#!/usr/bin/env node
/**
 * Threads 投稿削除スクリプト
 * Usage: node delete-threads-post.cjs <post_url>
 * 例: node delete-threads-post.cjs "https://www.threads.net/@username/post/ABC123"
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, postUrl] = process.argv;

if (!postUrl) {
  console.error('❌ 使い方: node delete-threads-post.cjs <post_url>');
  process.exit(1);
}

async function deleteThreadsPost(postUrl) {
  console.log('🗑️ Threads投稿削除開始...');
  console.log(`📍 URL: ${postUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  try {
    // Cookie設定（InstagramのCookieを使用）
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error('Cookie が見つかりません: ' + cookiesPath);
    }
    
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain?.replace('instagram.com', 'threads.net') || '.threads.net',
      path: c.path || '/'
    })));
    
    // 投稿ページにアクセス
    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // 「...」メニューをクリック
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of btns) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const svg = btn.querySelector('svg');
        if (ariaLabel.includes('More') || ariaLabel.includes('その他') || 
            ariaLabel.includes('オプション') || ariaLabel.includes('menu')) {
          btn.click();
          return true;
        }
        // SVGの形状で判断（3点リーダー）
        if (svg && btn.textContent.trim() === '') {
          const paths = svg.querySelectorAll('path, circle');
          if (paths.length >= 3) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    
    if (!moreClicked) throw new Error('「...」メニューが見つかりません');
    console.log('✅ メニュークリック');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 削除ボタンをクリック
    const deleteClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div[role="menuitem"], button'));
      for (const item of items) {
        const txt = item.textContent.trim();
        if (txt === 'Delete' || txt === '削除' || txt.includes('削除')) {
          item.click();
          return txt;
        }
      }
      return null;
    });
    
    if (!deleteClicked) throw new Error('削除ボタンが見つかりません');
    console.log(`✅ 削除ボタンクリック: ${deleteClicked}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 確認ボタンをクリック
    const confirmClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === 'Delete' || txt === '削除' || txt === 'OK' || txt === 'Confirm') {
          btn.click();
          return txt;
        }
      }
      return null;
    });
    
    if (!confirmClicked) throw new Error('確認ボタンが見つかりません');
    console.log(`✅ 確認ボタンクリック: ${confirmClicked}`);
    
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/tmp/threads-deleted.png' });
    console.log('✅ Threads投稿を削除しました');
    
  } finally {
    await browser.close();
  }
}

deleteThreadsPost(postUrl)
  .then(() => process.exit(0))
  .catch(e => { console.error('❌', e.message); process.exit(1); });
