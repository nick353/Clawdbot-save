#!/usr/bin/env node
/**
 * Instagram UI デバッグスクリプト
 * スクショ + DOM探索で投稿ボタンを探す
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('');
  console.log('='.repeat(50));
  console.log('🔍 Instagram UI デバッグ');
  console.log('='.repeat(50));
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let context;
  if (fs.existsSync(STATE_PATH)) {
    context = await browser.newContext({ storageState: STATE_PATH });
    console.log('✅ ブラウザプロファイル読み込み');
  } else {
    context = await browser.newContext();
    console.log('⚠️  ブラウザプロファイルなし（新規）');
  }

  const page = await context.newPage();

  // Instagram にアクセス
  console.log('🌐 Instagram にアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  // スクリーンショット
  await page.screenshot({ path: '/tmp/instagram-debug-full.png', fullPage: true });
  console.log('📸 フルページスクリーンショット: /tmp/instagram-debug-full.png');

  await page.screenshot({ path: '/tmp/instagram-debug-viewport.png', fullPage: false });
  console.log('📸 ビューポートスクリーンショット: /tmp/instagram-debug-viewport.png');

  // URL確認
  console.log(`📍 現在のURL: ${page.url()}`);

  // DOM探索: "Create"、"作成"、"投稿" などのテキストを含むボタン/リンク
  console.log('');
  console.log('🔍 投稿ボタン候補を探索中...');
  
  const candidates = await page.evaluate(() => {
    const results = [];
    
    // すべてのボタン・リンクを取得
    const elements = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
    
    elements.forEach((el, index) => {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const role = el.getAttribute('role') || '';
      
      // "Create", "作成", "投稿", "New", "Plus" などを含む要素
      const keywords = ['create', '作成', '投稿', 'new', 'plus', 'post', '新規'];
      const isCandidate = keywords.some(kw => 
        text.toLowerCase().includes(kw) || ariaLabel.toLowerCase().includes(kw)
      );
      
      if (isCandidate || ariaLabel.length > 0) {
        results.push({
          index,
          tag: el.tagName,
          text: text.substring(0, 50),
          ariaLabel,
          role,
          className: el.className,
        });
      }
    });
    
    return results;
  });

  console.log('');
  console.log('📋 投稿ボタン候補:');
  candidates.forEach(c => {
    console.log(`  [${c.index}] ${c.tag} - text:"${c.text}" aria-label:"${c.ariaLabel}" role:"${c.role}"`);
  });

  // SVGアイコンも探す（+アイコンなど）
  console.log('');
  console.log('🔍 SVGアイコンを探索中...');
  const svgIcons = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg');
    const results = [];
    
    svgs.forEach((svg, index) => {
      const parent = svg.parentElement;
      const ariaLabel = parent?.getAttribute('aria-label') || svg.getAttribute('aria-label') || '';
      const role = parent?.getAttribute('role') || svg.getAttribute('role') || '';
      
      if (ariaLabel || role) {
        results.push({
          index,
          ariaLabel,
          role,
          parentTag: parent?.tagName,
        });
      }
    });
    
    return results;
  });

  console.log('📋 SVGアイコン候補:');
  svgIcons.slice(0, 20).forEach(s => {
    console.log(`  [${s.index}] ${s.parentTag} - aria-label:"${s.ariaLabel}" role:"${s.role}"`);
  });

  // ナビゲーションバーの要素を探す
  console.log('');
  console.log('🔍 ナビゲーションバー要素を探索中...');
  const navElements = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return [];
    
    const links = nav.querySelectorAll('a, button, div[role="button"]');
    return Array.from(links).map((el, index) => ({
      index,
      tag: el.tagName,
      ariaLabel: el.getAttribute('aria-label') || '',
      href: el.getAttribute('href') || '',
      text: el.textContent?.trim().substring(0, 30) || '',
    }));
  });

  console.log('📋 ナビゲーションバー要素:');
  navElements.forEach(n => {
    console.log(`  [${n.index}] ${n.tag} - aria-label:"${n.ariaLabel}" href:"${n.href}" text:"${n.text}"`);
  });

  await browser.close();

  console.log('');
  console.log('='.repeat(50));
  console.log('✅ デバッグ完了');
  console.log('='.repeat(50));
  console.log('');
}

main().catch((err) => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
