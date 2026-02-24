#!/usr/bin/env node
/**
 * Instagram スマート待機版（モーダル表示まで待機）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');

async function main() {
  console.log('🔍 Instagram スマート待機版');
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

  await page.screenshot({ path: '/tmp/ig-smart-1-initial.png' });
  console.log('📸 初期状態: /tmp/ig-smart-1-initial.png');

  // 作成ボタンをクリック
  console.log('');
  console.log('🔍 作成ボタンを探索...');
  const createBtn = await page.$('svg[aria-label="New post"]');
  if (!createBtn) {
    console.log('❌ 作成ボタンが見つかりません');
    await browser.close();
    return;
  }

  await createBtn.click();
  console.log('✅ 作成ボタンをクリック');

  // モーダル表示を待機（最大10秒）
  console.log('⏳ モーダル表示を待機中...');
  try {
    await page.waitForSelector('div[role="dialog"], div[role="modal"]', { timeout: 10000 });
    console.log('✅ モーダル表示を確認');
  } catch (err) {
    console.log('⚠️  モーダル表示のタイムアウト（10秒）');
  }

  await page.screenshot({ path: '/tmp/ig-smart-2-modal.png' });
  console.log('📸 モーダル表示後: /tmp/ig-smart-2-modal.png');

  // ファイルインプットを待機（最大5秒）
  console.log('');
  console.log('🔍 ファイルインプットを待機中...');
  try {
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    console.log('✅ ファイルインプットを確認');
  } catch (err) {
    console.log('⚠️  ファイルインプットのタイムアウト（5秒）');
  }

  // 最終的なDOM構造を探索
  console.log('');
  console.log('🔍 最終的なDOM構造を探索...');
  
  const fileInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="file"]');
    return Array.from(inputs).map((el, index) => ({
      index,
      id: el.id,
      accept: el.accept,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 ファイルインプット候補:');
  fileInputs.forEach(f => {
    console.log(`  [${f.index}] id:"${f.id}" accept:"${f.accept}" visible:${f.visible}`);
  });

  const modals = await page.evaluate(() => {
    const elements = document.querySelectorAll('div[role="dialog"], div[role="modal"]');
    return Array.from(elements).map((el, index) => ({
      index,
      ariaLabel: el.getAttribute('aria-label') || '',
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
    }));
  });

  console.log('📋 モーダル候補:');
  modals.forEach(m => {
    console.log(`  [${m.index}] aria:"${m.ariaLabel}" visible:${m.visible}`);
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
