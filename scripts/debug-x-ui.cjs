#!/usr/bin/env node
/**
 * X (Twitter) UI デバッグスクリプト
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIE_PATH = '/root/clawd/skills/sns-multi-poster/cookies/x.json';

async function main() {
  console.log('🔍 X (Twitter) UI デバッグ');

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

  console.log('🌐 X にアクセス...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  await page.screenshot({ path: '/tmp/x-debug.png', fullPage: false });
  console.log('📸 スクリーンショット: /tmp/x-debug.png');

  console.log('🔍 ツイート入力欄を探索中...');
  
  const candidates = await page.evaluate(() => {
    const results = [];
    
    // テキストエリア・入力欄を探す
    const textareas = document.querySelectorAll('textarea, div[contenteditable="true"]');
    textareas.forEach((el, index) => {
      const placeholder = el.getAttribute('placeholder') || el.getAttribute('aria-label') || '';
      results.push({
        index,
        tag: el.tagName,
        placeholder,
        contentEditable: el.getAttribute('contenteditable'),
      });
    });
    
    return results;
  });

  console.log('📋 ツイート入力欄候補:');
  candidates.forEach(c => {
    console.log(`  [${c.index}] ${c.tag} - placeholder:"${c.placeholder}" contentEditable:"${c.contentEditable}"`);
  });

  // "Post"ボタンも探す
  const postButtons = await page.evaluate(() => {
    const results = [];
    const buttons = document.querySelectorAll('button, div[role="button"]');
    
    buttons.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      
      if (text.toLowerCase().includes('post') || text.toLowerCase().includes('tweet') || ariaLabel.toLowerCase().includes('post')) {
        results.push({
          index,
          text,
          ariaLabel,
        });
      }
    });
    
    return results;
  });

  console.log('📋 投稿ボタン候補:');
  postButtons.forEach(b => {
    console.log(`  [${b.index}] text:"${b.text}" aria-label:"${b.ariaLabel}"`);
  });

  await browser.close();
  console.log('✅ デバッグ完了');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
