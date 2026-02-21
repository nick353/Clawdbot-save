#!/usr/bin/env node
/**
 * Threads 投稿削除スクリプト v2（改善版）
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, postUrl] = process.argv;

if (!postUrl) {
  console.error('❌ 使い方: node delete-threads-post-v2.cjs <post_url>');
  process.exit(1);
}

async function deleteThreadsPost(postUrl, retryCount = 0) {
  console.log(`🗑️ Threads投稿削除開始... (試行 ${retryCount + 1}/2)`);
  console.log(`📍 URL: ${postUrl}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  const screenshotDir = '/tmp/sns-delete-screenshots';
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    const cookiesPath = path.join(__dirname, 'cookies/threads.json');
    if (!fs.existsSync(cookiesPath)) {
      throw new Error('Threads cookieが見つかりません: ' + cookiesPath);
    }
    
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.threads.net', path: c.path || '/'
    })));
    
    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // 投稿内容を取得
    const caption = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      for (const span of spans) {
        if (span.textContent.length > 10) {
          return span.textContent.trim().substring(0, 100);
        }
      }
      return '(キャプション取得失敗)';
    });
    console.log(`📝 投稿内容: ${caption}`);
    
    const beforePath = `${screenshotDir}/threads-${timestamp}-before.png`;
    await page.screenshot({ path: beforePath, fullPage: true });
    console.log(`📸 削除前: ${beforePath}`);
    
    // 「...」メニューをクリック
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of btns) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.includes('More') || ariaLabel.includes('その他')) {
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
      const divs = Array.from(document.querySelectorAll('div[role="button"]'));
      for (const div of divs) {
        const txt = div.textContent.trim();
        if (txt === 'Delete' || txt === '削除' || txt.includes('削除')) {
          div.click();
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
      const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const btn of btns) {
        const txt = btn.textContent.trim();
        if (txt === 'Delete' || txt === '削除') {
          btn.click();
          return txt;
        }
      }
      return null;
    });
    
    if (!confirmClicked) throw new Error('確認ボタンが見つかりません');
    console.log(`✅ 確認ボタンクリック: ${confirmClicked}`);
    
    await new Promise(r => setTimeout(r, 5000));
    
    const afterPath = `${screenshotDir}/threads-${timestamp}-after.png`;
    await page.screenshot({ path: afterPath, fullPage: true });
    console.log(`📸 削除後: ${afterPath}`);
    
    console.log('✅ Threads投稿を削除しました');
    console.log(`📝 削除した投稿: ${caption}`);
    
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    
    if (retryCount === 0) {
      console.log('🔄 30秒後にリトライします...');
      await browser.close();
      await new Promise(r => setTimeout(r, 30000));
      return deleteThreadsPost(postUrl, 1);
    } else {
      throw error;
    }
  } finally {
    await browser.close();
  }
}

deleteThreadsPost(postUrl)
  .then(() => process.exit(0))
  .catch(e => { console.error('❌ 削除失敗:', e.message); process.exit(1); });
