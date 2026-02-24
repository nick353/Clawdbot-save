#!/usr/bin/env node
/**
 * Instagram 詳細デバッグ（ボタンクリック後のUI状態）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('🔍 Instagram 詳細デバッグ（ボタンクリック後）');
  console.log('='.repeat(50));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  console.log('🌐 Instagram にアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  // スクリーンショット（初期状態）
  await page.screenshot({ path: '/tmp/ig-debug-1-initial.png' });
  console.log('📸 初期状態: /tmp/ig-debug-1-initial.png');

  // 作成ボタンをクリック（複数のセレクタを試行）
  console.log('');
  console.log('🔍 作成ボタンを探索...');
  
  const selectors = [
    'div[aria-label="New post"]',
    'div[role="img"][aria-label="New post"]',
    'a[href*="create"]',
    'svg[aria-label="New post"]',
  ];
  
  let createBtn = null;
  for (const sel of selectors) {
    createBtn = await page.$(sel);
    if (createBtn) {
      console.log(`✅ セレクタ "${sel}" で発見`);
      break;
    }
  }
  
  if (createBtn) {
    await createBtn.click();
    console.log('✅ 作成ボタンをクリック');
  } else {
    console.log('❌ 作成ボタンが見つかりません');
    await browser.close();
    return;
  }

  // クリック後の待機
  console.log('⏳ クリック後の待機（3秒）...');
  await page.waitForTimeout(3000);

  // スクリーンショット（クリック後）
  await page.screenshot({ path: '/tmp/ig-debug-2-after-click.png' });
  console.log('📸 クリック後: /tmp/ig-debug-2-after-click.png');

  // DOM構造を探索
  console.log('');
  console.log('🔍 DOM構造を探索（ファイルインプット）...');
  const fileInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="file"]');
    return Array.from(inputs).map((el, index) => ({
      index,
      id: el.id,
      name: el.name,
      accept: el.accept,
      className: el.className,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 ファイルインプット候補:');
  fileInputs.forEach(f => {
    console.log(`  [${f.index}] id:"${f.id}" name:"${f.name}" accept:"${f.accept}" visible:${f.visible}`);
  });

  // すべてのボタンを探索
  console.log('');
  console.log('🔍 ボタン・リンクを探索...');
  const buttons = await page.evaluate(() => {
    const elements = document.querySelectorAll('button, a, div[role="button"]');
    return Array.from(elements).slice(0, 30).map((el, index) => ({
      index,
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 30) || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 ボタン候補（上位30件）:');
  buttons.forEach(b => {
    console.log(`  [${b.index}] ${b.tag} - text:"${b.text}" aria:"${b.ariaLabel}" visible:${b.visible}`);
  });

  // モーダル・ダイアログを探索
  console.log('');
  console.log('🔍 モーダル・ダイアログを探索...');
  const modals = await page.evaluate(() => {
    const elements = document.querySelectorAll('div[role="dialog"], div[role="modal"], div.modal');
    return Array.from(elements).map((el, index) => ({
      index,
      ariaLabel: el.getAttribute('aria-label') || '',
      className: el.className,
      childCount: el.children.length,
    }));
  });

  console.log('📋 モーダル・ダイアログ:');
  modals.forEach(m => {
    console.log(`  [${m.index}] aria:"${m.ariaLabel}" class:"${m.className}" children:${m.childCount}`);
  });

  await browser.close();

  console.log('');
  console.log('='.repeat(50));
  console.log('✅ デバッグ完了');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
