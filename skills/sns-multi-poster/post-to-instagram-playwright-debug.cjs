#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト (Playwright デバッグ版)
 * スクリーンショットを撮りながら実行
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , imagePath, caption] = process.argv;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-playwright-debug.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log('🔄 DRY RUN: Instagram投稿スキップ');
  process.exit(0);
}

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');
const SCREENSHOTS_DIR = '/tmp/instagram-debug';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = path.join(SCREENSHOTS_DIR, `${label}-${ts}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 スクリーンショット: ${p}`);
  return p;
}

async function main() {
  console.log('📸 Instagram 投稿スクリプト (デバッグ版)');
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    if (!fs.existsSync(STATE_PATH) || !fs.existsSync(COOKIES_PATH)) {
      console.log('⚠️  ブラウザプロファイルが見つかりません');
      process.exit(1);
    }

    console.log('📂 ブラウザプロファイルを使用します');

    const context = await browser.newContext({
      storageState: STATE_PATH,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);
    console.log(`✅ Cookie数: ${cookies.length}`);

    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Instagram にアクセス
    console.log('');
    console.log('🌐 Instagram にアクセスしています...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await shot(page, '01-homepage');

    // 「ログイン情報を保存」モーダルを閉じる
    console.log('🔍 モーダルダイアログを確認中...');
    await page.waitForTimeout(2000);
    
    try {
      const closeSelectors = [
        'button:has-text("Not now")',
        'button:has-text("後で")',
        'button[aria-label="Close"]',
        'svg[aria-label="Close"]',
        'div[role="button"]:has-text("Not now")',
      ];
      
      let closed = false;
      for (const selector of closeSelectors) {
        try {
          const button = await page.waitForSelector(selector, { timeout: 3000 });
          if (button) {
            await button.click();
            console.log(`✅ モーダルを閉じました (${selector})`);
            await page.waitForTimeout(2000);
            closed = true;
            break;
          }
        } catch (e) {
          // 次のセレクタを試す
        }
      }
      
      if (!closed) {
        console.log('ℹ️  モーダルは表示されませんでした');
      }
    } catch (e) {
      console.log('ℹ️  モーダル処理でエラー:', e.message);
    }
    
    await shot(page, '02-after-modal');

    // 作成ボタンを探す
    console.log('🔍 作成ボタンを探しています...');
    
    // 正しいセレクタで作成ボタンを探す
    const createSelectors = [
      'svg[aria-label="New post"]',
      'a:has-text("Create")',
    ];

    let createButton = null;
    for (const selector of createSelectors) {
      try {
        createButton = await page.waitForSelector(selector, { timeout: 5000 });
        if (createButton) {
          console.log(`✅ 作成ボタン見つかりました: ${selector}`);
          break;
        }
      } catch (e) {
        // 次のセレクタを試す
      }
    }

    if (!createButton) {
      await shot(page, '02-no-create-button');
      console.error('❌ 作成ボタンが見つかりません');
      
      // デバッグ情報: ページ内の主要な要素を確認
      const elements = await page.evaluate(() => {
        const elems = Array.from(document.querySelectorAll('div[aria-label], a, button, svg[aria-label]'));
        return elems.slice(0, 30).map(el => ({
          tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          text: el.textContent?.substring(0, 50),
          role: el.getAttribute('role'),
        }));
      });
      console.log('📋 ページ内の主要な要素:');
      console.log(JSON.stringify(elements, null, 2));
      
      process.exit(1);
    }

    await createButton.click();
    console.log('✅ 作成ボタンをクリック');
    await page.waitForTimeout(3000);
    await shot(page, '03-after-create-click');

    // ファイル入力要素を探す
    console.log('');
    console.log('📸 ファイル入力要素を探しています...');
    
    const fileSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="video"]',
    ];

    let fileInput = null;
    for (const selector of fileSelectors) {
      try {
        fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✅ ファイル入力要素見つかりました: ${selector}`);
          break;
        }
      } catch (e) {
        // 次のセレクタを試す
      }
      await page.waitForTimeout(1000);
    }

    if (!fileInput) {
      await shot(page, '04-no-file-input');
      
      // デバッグ情報: すべてのinput要素を確認
      const inputs = await page.evaluate(() => {
        const elems = Array.from(document.querySelectorAll('input'));
        return elems.map(el => ({
          type: el.type,
          accept: el.accept,
          name: el.name,
          id: el.id,
          visible: el.offsetWidth > 0 && el.offsetHeight > 0,
        }));
      });
      console.log('📋 ページ内のinput要素:');
      console.log(JSON.stringify(inputs, null, 2));
      
      console.error('❌ ファイル入力要素が見つかりません');
      process.exit(1);
    }

    await fileInput.setInputFiles(path.resolve(imagePath));
    console.log('✅ 画像をアップロード');
    await page.waitForTimeout(5000);
    await shot(page, '05-after-upload');

    console.log('');
    console.log('✅ デバッグ実行完了');
    console.log(`📸 スクリーンショット: ${SCREENSHOTS_DIR}`);

    await context.close();
  } catch (error) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
