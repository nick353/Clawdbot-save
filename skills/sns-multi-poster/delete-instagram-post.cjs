#!/usr/bin/env node
/**
 * Instagram 投稿削除スクリプト
 * Usage: node delete-instagram-post.cjs <post_url_or_code>
 * 例: node delete-instagram-post.cjs "https://www.instagram.com/p/ABC123/"
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, postUrl] = process.argv;

if (!postUrl) {
  console.error('❌ 使い方: node delete-instagram-post.cjs <post_url>');
  process.exit(1);
}

async function deleteInstagramPost(postUrl) {
  console.log('🗑️ Instagram投稿削除開始...');
  console.log(`📍 URL: ${postUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  try {
    // Cookie設定
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error('Instagram cookieが見つかりません: ' + cookiesPath);
    }
    
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.instagram.com', path: c.path || '/'
    })));
    
    // 投稿ページにアクセス
    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // 「...」メニューをクリック
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of btns) {
        const svg = btn.querySelector('svg[aria-label*="More"], svg[aria-label*="その他"], svg[aria-label*="オプション"]');
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (svg || ariaLabel.includes('More') || ariaLabel.includes('その他') || ariaLabel.includes('オプション')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (!moreClicked) throw new Error('「...」メニューが見つかりません');
    console.log('✅ メニュークリック');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 削除ボタンをクリック
    const deleteClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === 'Delete' || txt === '削除' || txt.includes('削除')) {
          btn.click();
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
        if (txt === 'Delete' || txt === '削除' || txt === 'OK') {
          const style = window.getComputedStyle(btn);
          // 赤いボタン（危険操作）を探す、またはDeleteテキスト
          if (style.color.includes('255, 48, 64') || txt === 'Delete' || txt === '削除') {
            btn.click();
            return txt;
          }
        }
      }
      return null;
    });
    
    if (!confirmClicked) throw new Error('確認ボタンが見つかりません');
    console.log(`✅ 確認ボタンクリック: ${confirmClicked}`);
    
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/tmp/instagram-deleted.png' });
    console.log('✅ Instagram投稿を削除しました');
    
  } finally {
    await browser.close();
  }
}

deleteInstagramPost(postUrl)
  .then(() => process.exit(0))
  .catch(e => { console.error('❌', e.message); process.exit(1); });
