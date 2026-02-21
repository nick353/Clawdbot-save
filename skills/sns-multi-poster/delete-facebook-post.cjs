#!/usr/bin/env node
/**
 * Facebook 投稿削除スクリプト
 * Usage: node delete-facebook-post.cjs <post_url>
 * 例: node delete-facebook-post.cjs "https://www.facebook.com/username/posts/123456"
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, postUrl] = process.argv;

if (!postUrl) {
  console.error('❌ 使い方: node delete-facebook-post.cjs <post_url>');
  process.exit(1);
}

async function deleteFacebookPost(postUrl) {
  console.log('🗑️ Facebook投稿削除開始...');
  console.log(`📍 URL: ${postUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  try {
    // Cookie設定
    const cookiesPath = path.join(__dirname, 'cookies/facebook.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error('Facebook cookieが見つかりません: ' + cookiesPath);
    }
    
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.facebook.com', path: c.path || '/'
    })));
    
    // 投稿ページにアクセス
    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    
    // 「...」メニューをクリック
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"], button'));
      for (const btn of btns) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Actions') || ariaLabel.includes('More') || 
            ariaLabel.includes('その他') || ariaLabel.includes('アクション')) {
          btn.click();
          return ariaLabel;
        }
        // 3点リーダーアイコン
        const svg = btn.querySelector('svg');
        if (svg && btn.textContent.trim() === '') {
          btn.click();
          return 'svg-menu';
        }
      }
      return null;
    });
    
    if (!moreClicked) throw new Error('「...」メニューが見つかりません');
    console.log(`✅ メニュークリック: ${moreClicked}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 削除ボタンをクリック
    const deleteClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], span, div'));
      for (const item of items) {
        const txt = item.textContent.trim();
        if (txt === 'Move to trash' || txt === 'Delete post' || txt === 'Delete' || 
            txt === '削除' || txt.includes('ゴミ箱')) {
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
      const btns = Array.from(document.querySelectorAll('[role="button"], button'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === 'Move to trash' || txt === 'Delete' || txt === '削除' || 
            txt === 'Confirm' || txt === 'OK') {
          btn.click();
          return txt;
        }
      }
      return null;
    });
    
    if (!confirmClicked) throw new Error('確認ボタンが見つかりません');
    console.log(`✅ 確認ボタンクリック: ${confirmClicked}`);
    
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/tmp/facebook-deleted.png' });
    console.log('✅ Facebook投稿を削除しました');
    
  } finally {
    await browser.close();
  }
}

deleteFacebookPost(postUrl)
  .then(() => process.exit(0))
  .catch(e => { console.error('❌', e.message); process.exit(1); });
