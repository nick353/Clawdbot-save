#!/usr/bin/env node
/**
 * Threads UI デバッグスクリプト
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('🔍 Threads UI デバッグ');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let context;
  if (fs.existsSync(STATE_PATH)) {
    context = await browser.newContext({ storageState: STATE_PATH });
    console.log('✅ ブラウザプロファイル読み込み');
  } else {
    context = await browser.newContext();
  }

  const page = await context.newPage();

  console.log('🌐 Threads にアクセス...');
  await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  await page.screenshot({ path: '/tmp/threads-debug.png', fullPage: false });
  console.log('📸 スクリーンショット: /tmp/threads-debug.png');

  console.log('🔍 投稿ボタン候補を探索中...');
  
  const candidates = await page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
    
    elements.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      
      const keywords = ['new', '投稿', 'post', 'create', 'thread', '作成'];
      const isCandidate = keywords.some(kw => 
        text.toLowerCase().includes(kw) || ariaLabel.toLowerCase().includes(kw)
      );
      
      if (isCandidate || ariaLabel.includes('New')) {
        results.push({
          index,
          tag: el.tagName,
          text: text.substring(0, 50),
          ariaLabel,
          role: el.getAttribute('role') || '',
        });
      }
    });
    
    return results;
  });

  console.log('📋 投稿ボタン候補:');
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
