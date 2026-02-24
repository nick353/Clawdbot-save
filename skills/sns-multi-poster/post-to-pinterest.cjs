#!/usr/bin/env node
/**
 * Pinterest 投稿スクリプト - Cookie認証版
 * 
 * Usage: node post-to-pinterest.cjs <image_path> <caption> [board_name]
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const imagePath = process.argv[2];
const caption = process.argv[3];
const boardName = process.argv[4] || 'Animal'; // デフォルト: "Animal"

if (!imagePath || !caption) {
  console.error('使い方: node post-to-pinterest.cjs <image_path> <caption> [board_name]');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Pinterest投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log(`📌 ボード: ${boardName}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

async function postToPinterest(imagePath, caption, boardName) {
  console.log('📌 Pinterest に投稿開始...');
  console.log(`📝 キャプション: ${caption.substring(0, 100)}...`);
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📂 ボード: ${boardName}`);
  
  // キャプションから title と description を分離
  const lines = caption.split('\n').filter(line => line.trim());
  const title = lines[0] || caption.substring(0, 100);
  const description = caption;
  
  console.log(`📝 タイトル: ${title.substring(0, 50)}...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // User-Agent設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/pinterest.json');
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    
    // Cookieを設定
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');
    
    // Pinterest pin creation toolにアクセス
    console.log('📂 Pinterest pin creation tool にアクセス中...');
    await page.goto('https://jp.pinterest.com/pin-creation-tool/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 120000 
    });
    
    // ページが読み込まれるまで待機（延長）
    console.log('⏳ ページ読み込み待機中...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !window.location.href.includes('/login');
    });
    
    if (!isLoggedIn) {
      console.error('❌ ログインしていません。Cookieが無効の可能性があります。');
      await page.screenshot({ path: '/tmp/pinterest-login-error.png' });
      console.log('📸 スクリーンショット保存: /tmp/pinterest-login-error.png');
      throw new Error('Not logged in');
    }
    
    console.log('✅ ログイン確認完了');
    
    // 画像アップロード（Pinterestは先に画像をアップロード）
    console.log('📷 画像アップロード中...');
    
    // ファイル入力を探す（複数セレクタを試す）
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[name="media"]',
      '[data-test-id="storyboard-upload-input"]'
    ];

    let fileInput = null;
    for (const selector of fileInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✅ ファイル入力を発見: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️  ファイル入力失敗: ${selector}`);
      }
    }
    
    if (!fileInput) {
      console.error('❌ ファイル入力が見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-no-file-input.png' });
      console.log('📸 スクリーンショット保存: /tmp/pinterest-no-file-input.png');
      throw new Error('File input not found');
    }
    
    // ファイルをアップロード
    await fileInput.uploadFile(imagePath);
    
    console.log('✅ 画像アップロード開始');
    
    // アップロード完了を待つ（画像プレビューが表示されるまで）
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // タイトル入力
    console.log('📝 タイトル入力中...');
    
    const titleSelectors = [
      '[data-test-id="pin-draft-title"]',
      'input[placeholder*="タイトル"]',
      'input[placeholder*="title" i]',
      '[aria-label*="タイトル"]'
    ];
    
    let titleEntered = false;
    for (const selector of titleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        await page.type(selector, title, { delay: 50 });
        titleEntered = true;
        console.log(`✅ タイトル入力完了 (${selector})`);
        break;
      } catch (e) {
        console.log(`⚠️  タイトル入力失敗: ${selector}`);
      }
    }
    
    if (!titleEntered) {
      console.error('❌ タイトル入力エリアが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-no-title-input.png' });
      throw new Error('Title input not found');
    }
    
    // 説明文入力
    console.log('📝 説明文入力中...');
    
    const descriptionSelectors = [
      '[data-test-id="pin-draft-description"]',
      'textarea[placeholder*="説明"]',
      'textarea[placeholder*="description" i]',
      'textarea[placeholder*="Add a detailed description"]',
      'div[data-test-id="pin-draft-description"] textarea',
      '[aria-label*="説明"]',
      '[aria-label*="Description" i]',
      'textarea'
    ];
    
    let descriptionEntered = false;
    for (const selector of descriptionSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        await page.type(selector, description, { delay: 50 });
        descriptionEntered = true;
        console.log(`✅ 説明文入力完了 (${selector})`);
        break;
      } catch (e) {
        console.log(`⚠️  説明文入力失敗: ${selector}`);
      }
    }
    
    if (!descriptionEntered) {
      console.error('❌ 説明文入力エリアが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-no-description-input.png' });
      throw new Error('Description input not found');
    }
    
    // ボード選択
    console.log(`📂 ボード選択中 (${boardName})...`);
    
    const boardSelectors = [
      '[data-test-id="board-dropdown-select-button"]',
      'button[aria-label*="ボード"]',
      'button[aria-label*="board" i]',
      '[role="button"]:has-text("ボード")'
    ];
    
    let boardOpened = false;
    for (const selector of boardSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        boardOpened = true;
        console.log(`✅ ボードドロップダウンを開きました (${selector})`);
        break;
      } catch (e) {
        console.log(`⚠️  ボードドロップダウン失敗: ${selector}`);
      }
    }
    
    if (boardOpened) {
      // ボードリストから選択
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ボード名をクリック
      try {
        const clicked = await page.evaluate((name) => {
          const elements = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [data-test-id*="board"]'));
          const target = elements.find(el => el.textContent.includes(name));
          if (target) { target.click(); return true; }
          return false;
        }, boardName);
        
        if (clicked) {
          console.log(`✅ ボード "${boardName}" を選択しました`);
        } else {
          console.log(`⚠️  ボード "${boardName}" が見つかりません（デフォルトボードを使用）`);
          // Escキーでドロップダウンを閉じる
          await page.keyboard.press('Escape');
        }
      } catch (e) {
        console.log(`⚠️  ボード選択失敗: ${e.message}（デフォルトボードを使用）`);
      }
    } else {
      console.log('⚠️  ボード選択エリアが見つかりません（デフォルトボードを使用）');
    }
    
    // スクリーンショット（投稿前の確認）
    await page.screenshot({ path: '/tmp/pinterest-before-post.png' });
    console.log('📸 投稿前スクリーンショット: /tmp/pinterest-before-post.png');
    
    // DRY RUN: 実際には投稿しない
    if (process.env.DRY_RUN === 'true') {
      console.log('🔄 DRY RUN: 投稿ボタンは押しません');
      console.log('✅ テスト完了（投稿なし）');
      return { success: true, dryRun: true };
    }
    
    // 投稿ボタンをクリック
    console.log('📤 投稿ボタンをクリック...');
    
    const publishButtonSelectors = [
      '[data-test-id="board-dropdown-save-button"]',
      'button[data-test-id*="publish"]',
      'button[data-test-id="pin-draft-save-button"]',
      'button[data-test-id="create-pin-submit"]'
    ];
    
    let published = false;
    for (const selector of publishButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        published = true;
        console.log(`✅ 投稿ボタンをクリックしました (${selector})`);
        break;
      } catch (e) {
        console.log(`⚠️  投稿ボタン失敗: ${selector}`);
      }
    }
    
    // JS evaluateでボタンをテキストで検索
    if (!published) {
      try {
        published = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const publishBtn = buttons.find(b => {
            const t = b.textContent.trim().toLowerCase();
            return t === 'publish' || t === '公開' || t === 'save' || t === '保存';
          });
          if (publishBtn) {
            publishBtn.click();
            return true;
          }
          return false;
        });
        if (published) console.log('✅ 投稿ボタンをJS evaluateでクリックしました');
      } catch (e) {
        console.log(`⚠️  JS evaluate失敗: ${e.message}`);
      }
    }
    
    if (!published) {
      console.error('❌ 投稿ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-no-publish-button.png' });
      throw new Error('Publish button not found');
    }
    
    // 投稿完了を待つ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 投稿後のスクリーンショット
    await page.screenshot({ path: '/tmp/pinterest-after-post.png' });
    console.log('📸 投稿後スクリーンショット: /tmp/pinterest-after-post.png');
    
    console.log('✅ Pinterest投稿完了！');
    
    return { 
      success: true, 
      platform: 'Pinterest', 
      board: boardName,
      screenshot: '/tmp/pinterest-after-post.png' 
    };
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    
    // エラー時のスクリーンショット
    try {
      await page.screenshot({ path: '/tmp/pinterest-error.png' });
      console.log('📸 エラースクリーンショット: /tmp/pinterest-error.png');
    } catch (e) {
      // スクリーンショット取得失敗は無視
    }
    
    throw error;
  } finally {
    await browser.close();
  }
}

// 実行
postToPinterest(imagePath, caption, boardName)
  .then(result => {
    console.log('\n✅ 投稿成功！');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 投稿失敗:', error.message);
    process.exit(1);
  });
