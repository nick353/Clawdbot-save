#!/usr/bin/env node
/**
 * Threads 詳細デバッグ（ボタンクリック後のUI状態）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('🔍 Threads 詳細デバッグ（ボタンクリック後）');
  console.log('='.repeat(50));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  console.log('🌐 Threads にアクセス...');
  await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ ページ読み込み完了');

  await page.screenshot({ path: '/tmp/threads-debug-1-initial.png' });
  console.log('📸 初期状態: /tmp/threads-debug-1-initial.png');

  // 投稿ボタンをクリック（"What's new?"）
  console.log('');
  console.log('🔍 投稿ボタンを探索...');
  const postBtn = await page.$('div[aria-label*="compose"]');
  if (postBtn) {
    await postBtn.click();
    console.log('✅ 投稿ボタンをクリック');
  } else {
    console.log('❌ 投稿ボタンが見つかりません');
    await browser.close();
    return;
  }

  console.log('⏳ クリック後の待機（3秒）...');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/threads-debug-2-after-click.png' });
  console.log('📸 クリック後: /tmp/threads-debug-2-after-click.png');

  // テキスト入力欄を探索
  console.log('');
  console.log('🔍 テキスト入力欄を探索...');
  const textInputs = await page.evaluate(() => {
    const textareas = document.querySelectorAll('textarea, div[contenteditable="true"]');
    return Array.from(textareas).map((el, index) => ({
      index,
      tag: el.tagName,
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      contentEditable: el.getAttribute('contenteditable') || '',
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 テキスト入力欄候補:');
  textInputs.forEach(t => {
    console.log(`  [${t.index}] ${t.tag} - placeholder:"${t.placeholder}" aria:"${t.ariaLabel}" visible:${t.visible}`);
  });

  // ファイルインプットも探索
  console.log('');
  console.log('🔍 ファイルインプットを探索...');
  const fileInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="file"]');
    return Array.from(inputs).map((el, index) => ({
      index,
      accept: el.accept,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 ファイルインプット候補:');
  fileInputs.forEach(f => {
    console.log(`  [${f.index}] accept:"${f.accept}" visible:${f.visible}`);
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
