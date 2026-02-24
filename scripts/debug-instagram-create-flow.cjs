#!/usr/bin/env node
/**
 * Instagram 作成フローデバッグスクリプト
 * 「New post」ボタンクリック後の要素を確認
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');
const OUTPUT_DIR = '/tmp/sns-ui-debug';

async function debugInstagramCreateFlow() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('📸 Instagram 作成フロー デバッグ開始...');
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  // Cookie読み込み
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Cookie読み込み完了');
  }

  const page = await context.newPage();

  // 1. ページ読み込み
  console.log('🌐 Instagram にアクセス中...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // スクリーンショット1: 初期状態
  const screenshot1 = path.join(OUTPUT_DIR, 'instagram-2-before-click.png');
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log(`📸 スクリーンショット保存: ${screenshot1}`);

  // 2. 「New post」ボタンを探す
  console.log('');
  console.log('🔍 「New post」ボタンを探しています...');
  
  const newPostButton = await page.$('svg[aria-label="New post"]');
  if (newPostButton) {
    console.log('✅ 「New post」SVGアイコンが見つかりました');
    
    // 親要素（クリック可能なボタン）を取得
    const clickableParent = await page.evaluateHandle((svg) => {
      let parent = svg.parentElement;
      while (parent) {
        if (parent.getAttribute('role') === 'link' || parent.tagName === 'A') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return svg.parentElement;
    }, newPostButton);
    
    console.log('✅ クリック可能な親要素を取得');
    
    // クリック
    await clickableParent.asElement().click();
    console.log('✅ 「New post」ボタンをクリック');
    
    // モーダルが開くまで待機
    await page.waitForTimeout(5000);
    
    // スクリーンショット2: クリック後
    const screenshot2 = path.join(OUTPUT_DIR, 'instagram-3-after-click.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`📸 スクリーンショット保存: ${screenshot2}`);
    
    // HTML保存
    const htmlPath = path.join(OUTPUT_DIR, 'instagram-3-after-click.html');
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`📄 HTML保存: ${htmlPath}`);
    
    // 3. ファイル入力要素を探す
    console.log('');
    console.log('🔍 ファイル入力要素を探しています...');
    
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`  ファイル入力総数: ${fileInputs.length}`);
    
    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const accept = await input.getAttribute('accept');
      const multiple = await input.getAttribute('multiple');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      const isVisible = await input.isVisible();
      console.log(`  [${i}] accept="${accept}" multiple="${multiple}" id="${id}" name="${name}" visible=${isVisible}`);
    }
    
    // 4. 他の主要要素を探す
    console.log('');
    console.log('🔍 他の主要要素を探しています...');
    
    const modals = await page.$$('div[role="dialog"]');
    console.log(`  モーダル総数: ${modals.length}`);
    
    const buttons = await page.$$('button');
    console.log(`  ボタン総数: ${buttons.length} (最初の10個のみ表示)`);
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      console.log(`    [${i}] text="${text?.trim()}" aria-label="${ariaLabel}"`);
    }
    
  } else {
    console.log('❌ 「New post」SVGアイコンが見つかりませんでした');
  }

  await browser.close();
  
  console.log('');
  console.log('=========================================');
  console.log('✅ デバッグ完了');
  console.log('=========================================');
}

(async () => {
  try {
    await debugInstagramCreateFlow();
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
})();
