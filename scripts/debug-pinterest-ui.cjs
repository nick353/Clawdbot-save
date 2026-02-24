#!/usr/bin/env node
/**
 * Pinterest UI デバッグスクリプト
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json';

async function main() {
  console.log('🔍 Pinterest UI デバッグ');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('✅ Cookie読み込み');
  }

  console.log('🌐 Pinterest にアクセス...');
  await page.goto('https://www.pinterest.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  await page.screenshot({ path: '/tmp/pinterest-debug.png', fullPage: false });
  console.log('📸 スクリーンショット: /tmp/pinterest-debug.png');

  console.log('🔍 ピン作成ボタンを探索中...');
  
  const candidates = await page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('button, a, div[role="button"]');
    
    elements.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      
      const keywords = ['create', '作成', 'pin', 'ピン', 'new', '+'];
      const isCandidate = keywords.some(kw => 
        text.toLowerCase().includes(kw) || ariaLabel.toLowerCase().includes(kw)
      );
      
      if (isCandidate) {
        results.push({
          index,
          tag: el.tagName,
          text: text.substring(0, 50),
          ariaLabel,
        });
      }
    });
    
    return results;
  });

  console.log('📋 ピン作成ボタン候補:');
  candidates.forEach(c => {
    console.log(`  [${c.index}] ${c.tag} - text:"${c.text}" aria-label:"${c.ariaLabel}"`);
  });

  await browser.close();
  console.log('✅ デバッグ完了');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
