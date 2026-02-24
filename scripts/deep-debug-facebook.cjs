#!/usr/bin/env node
/**
 * Facebook 詳細デバッグ（ボタンクリック後のUI状態）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/facebook';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('🔍 Facebook 詳細デバッグ（ボタンクリック後）');
  console.log('='.repeat(50));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  console.log('🌐 Facebook にアクセス...');
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  await page.screenshot({ path: '/tmp/fb-debug-1-initial.png' });
  console.log('📸 初期状態: /tmp/fb-debug-1-initial.png');

  // 投稿作成ボタンをクリック
  console.log('');
  console.log('🔍 投稿作成ボタンを探索...');
  const createBtn = await page.$('div:has-text("What\'s on your mind")');
  if (createBtn) {
    await createBtn.click();
    console.log('✅ 投稿作成ボタンをクリック');
  } else {
    console.log('❌ 投稿作成ボタンが見つかりません');
    await browser.close();
    return;
  }

  console.log('⏳ クリック後の待機（3秒）...');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/fb-debug-2-after-click.png' });
  console.log('📸 クリック後: /tmp/fb-debug-2-after-click.png');

  // テキスト入力欄を探索
  console.log('');
  console.log('🔍 テキスト入力欄を探索...');
  const textInputs = await page.evaluate(() => {
    const elements = document.querySelectorAll('textarea, div[contenteditable="true"]');
    return Array.from(elements).map((el, index) => ({
      index,
      tag: el.tagName,
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      text: el.textContent?.substring(0, 30) || '',
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 テキスト入力欄候補:');
  textInputs.forEach(t => {
    console.log(`  [${t.index}] ${t.tag} - placeholder:"${t.placeholder}" aria:"${t.ariaLabel}" visible:${t.visible}`);
  });

  // 投稿ボタンを探索
  console.log('');
  console.log('🔍 投稿ボタンを探索...');
  const postButtons = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, div[role="button"]');
    return Array.from(buttons).map((el, index) => ({
      index,
      text: el.textContent?.trim().substring(0, 30) || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      disabled: el.hasAttribute('disabled'),
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 投稿ボタン候補（上位20件）:');
  postButtons.slice(0, 20).forEach(b => {
    console.log(`  [${b.index}] text:"${b.text}" aria:"${b.ariaLabel}" disabled:${b.disabled} visible:${b.visible}`);
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
