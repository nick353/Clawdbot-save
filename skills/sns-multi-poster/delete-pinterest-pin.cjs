#!/usr/bin/env node
/**
 * Pinterest ピン削除スクリプト
 * Usage: node delete-pinterest-pin.cjs <pin_url>
 * 例: node delete-pinterest-pin.cjs "https://www.pinterest.com/pin/123456789/"
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, pinUrl] = process.argv;

if (!pinUrl) {
  console.error('❌ 使い方: node delete-pinterest-pin.cjs <pin_url>');
  process.exit(1);
}

async function deletePinterestPin(pinUrl) {
  console.log('🗑️ Pinterest ピン削除開始...');
  console.log(`📍 URL: ${pinUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  try {
    // Cookie設定
    const cookiesPath = path.join(__dirname, 'cookies/pinterest.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error('Pinterest cookieが見つかりません: ' + cookiesPath);
    }
    
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.pinterest.com', path: c.path || '/'
    })));
    
    // ピンページにアクセス
    await page.goto(pinUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // 「...」メニューをクリック
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of btns) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.includes('More') || ariaLabel.includes('その他') || 
            ariaLabel.includes('オプション') || ariaLabel.includes('options')) {
          btn.click();
          return ariaLabel;
        }
        // 3点リーダーアイコン
        const svg = btn.querySelector('svg');
        if (svg && btn.textContent.trim() === '') {
          const title = svg.getAttribute('title') || '';
          if (title.includes('More') || title.includes('その他')) {
            btn.click();
            return title;
          }
        }
      }
      return null;
    });
    
    if (!moreClicked) throw new Error('「...」メニューが見つかりません');
    console.log(`✅ メニュークリック: ${moreClicked}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 削除ボタンをクリック
    const deleteClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], div, span'));
      for (const item of items) {
        const txt = item.textContent.trim();
        if (txt === 'Delete Pin' || txt === 'Delete' || txt === '削除' || 
            txt.includes('ピンを削除')) {
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
        if (txt === 'Delete' || txt === '削除' || txt === 'Confirm' || txt === 'OK') {
          btn.click();
          return txt;
        }
      }
      return null;
    });
    
    if (!confirmClicked) throw new Error('確認ボタンが見つかりません');
    console.log(`✅ 確認ボタンクリック: ${confirmClicked}`);
    
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/tmp/pinterest-deleted.png' });
    console.log('✅ Pinterest ピンを削除しました');
    
  } finally {
    await browser.close();
  }
}

deletePinterestPin(pinUrl)
  .then(() => process.exit(0))
  .catch(e => { console.error('❌', e.message); process.exit(1); });
