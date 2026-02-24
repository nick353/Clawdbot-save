#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const SCREENSHOT_DIR = '/tmp/instagram-debug';
const DRY_RUN = process.env.DRY_RUN === 'true';

// セレクタ定義（学習により更新される）
const SELECTORS = {
  createButton: 'svg[aria-label="New post"]',  // 作成ボタン
  fileInput: 'input[type="file"]',
  caption: 'textarea[aria-label*="caption"]',
  nextButton: 'button:has-text("Next")',
  shareButton: 'button:has-text("Share")',
};

// Cookie読み込み
function loadCookies() {
  if (!fs.existsSync(COOKIES_PATH)) {
    throw new Error(`Cookieファイルが見つかりません: ${COOKIES_PATH}`);
  }
  
  const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
  return cookies.map(c => ({
    name: c.name,
    value: decodeURIComponent(c.value),
    domain: c.domain || '.instagram.com',
    path: c.path || '/',
    secure: c.secure !== false,
    httpOnly: c.httpOnly === true,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
    expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
  }));
}

// スクリーンショット保存（エラー報告用）
async function saveDebugScreenshot(page, step, errorMessage) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  const filename = `${SCREENSHOT_DIR}/${step}-${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  
  const errorFile = `${SCREENSHOT_DIR}/error.json`;
  fs.writeFileSync(errorFile, JSON.stringify({
    step,
    error: errorMessage,
    screenshot: filename,
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.error(`❌ エラー: ${errorMessage}`);
  console.error(`📸 スクリーンショット: ${filename}`);
  console.error(`📄 エラー情報: ${errorFile}`);
  
  return { screenshot: filename, errorFile };
}

// メイン処理
async function postToInstagram(imagePath, caption) {
  console.log('🚀 Instagram投稿開始');
  console.log(`📁 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption}`);
  console.log(`🔄 DRY_RUN: ${DRY_RUN}`);
  console.log('');

  // Cookie読み込み
  console.log('🍪 Cookie読み込み中...');
  const cookies = loadCookies();
  console.log(`✅ Cookie読み込み完了（${cookies.length}個）`);

  // ブラウザ起動
  console.log('🌐 ブラウザ起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
      '--disable-gpu'
    ],
    executablePath: '/usr/bin/google-chrome',
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Cookie設定
  await page.setCookie(...cookies);
  console.log('✅ Cookie設定完了');

  try {
    // Step 1: Instagramホームページに遷移
    console.log('📄 Instagramホームページに遷移中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Instagramホームページ表示');

    // Step 2: 「作成」ボタンをクリック
    console.log('🔘 「作成」ボタンをクリック中...');
    
    // 複数のセレクタを順番に試す
    const createButtonSelectors = [
      'xpath//svg[@aria-label="New post"]',
      'xpath//svg[@aria-label="作成"]',
      'svg[aria-label="New post"]',
      'svg[aria-label="作成"]',
    ];
    
    let createButton = null;
    for (const selector of createButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        const buttons = await page.$$(selector);
        if (buttons.length > 0) {
          createButton = buttons[0];
          console.log(`✅ 「作成」ボタン発見: ${selector}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ セレクタ失敗: ${selector}`);
      }
    }
    
    if (!createButton) {
      await saveDebugScreenshot(page, 'create-button-not-found', `「作成」ボタンが見つかりません`);
      throw new Error(`「作成」ボタンが見つかりません`);
    }
    
    // SVGの親要素（クリック可能な要素）をクリック
    await createButton.evaluate(el => {
      // SVGの親要素を探してクリック
      let parent = el.parentElement;
      while (parent && parent.tagName !== 'A' && parent.tagName !== 'BUTTON' && parent.tagName !== 'DIV') {
        parent = parent.parentElement;
      }
      if (parent) {
        parent.click();
      } else {
        el.click();
      }
    });
    
    console.log('✅ 「作成」ボタンクリック完了');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2.5: 「Post」メニュー項目をクリック
    console.log('📝 「Post」メニュー項目をクリック中...');
    
    const postMenuSelector = 'xpath//span[text()="Post"]';
    
    try {
      await page.waitForSelector(postMenuSelector, { timeout: 10000 });
    } catch (err) {
      await saveDebugScreenshot(page, 'post-menu-not-found', `「Post」メニュー項目が見つかりません`);
      throw new Error(`「Post」メニュー項目が見つかりません: ${err.message}`);
    }
    
    const postMenuButtons = await page.$$(postMenuSelector);
    
    if (postMenuButtons.length === 0) {
      await saveDebugScreenshot(page, 'post-menu-empty', `「Post」メニュー項目が見つかりません（要素なし）`);
      throw new Error(`「Post」メニュー項目が見つかりません（要素なし）`);
    }
    
    // 「Post」メニュー項目をクリック
    await postMenuButtons[0].click();
    console.log('✅ 「Post」メニュー項目クリック完了');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: ファイルアップロード
    console.log('📤 ファイルアップロード中...');
    const fileInput = await page.$(SELECTORS.fileInput);
    
    if (!fileInput) {
      await saveDebugScreenshot(page, 'file-input-not-found', `ファイル入力が見つかりません: ${SELECTORS.fileInput}`);
      throw new Error(`ファイル入力が見つかりません: ${SELECTORS.fileInput}`);
    }

    if (!DRY_RUN) {
      await fileInput.uploadFile(imagePath);
      console.log('✅ ファイルアップロード完了');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('🔄 DRY RUN: ファイルアップロードをスキップ');
    }

    // Step 3: キャプション入力
    console.log('📝 キャプション入力中...');
    await page.waitForSelector(SELECTORS.caption, { timeout: 10000 });
    
    if (!DRY_RUN) {
      await page.click(SELECTORS.caption);
      await page.type(SELECTORS.caption, caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('🔄 DRY RUN: キャプション入力をスキップ');
    }

    // Step 4: 投稿実行
    console.log('🚀 投稿実行中...');
    await page.waitForSelector(SELECTORS.shareButton, { timeout: 10000 });
    
    if (!DRY_RUN) {
      await page.click(SELECTORS.shareButton);
      console.log('✅ 投稿ボタンクリック完了');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('🔄 DRY RUN: 投稿をスキップ');
    }

    console.log('');
    console.log('✅ Instagram投稿完了！');

  } catch (error) {
    console.error('❌ エラー発生:', error.message);
    
    // エラー時にスクリーンショット保存
    await saveDebugScreenshot(page, 'error', error.message);
    
    // Discordに通知（エラーファイルパスを含む）
    console.error('');
    console.error('📢 Claude介入が必要です');
    console.error(`📂 エラー情報: ${SCREENSHOT_DIR}/error.json`);
    
    throw error;
  } finally {
    await browser.close();
  }
}

// CLI引数パース
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ 使い方: node post-instagram-simple.mjs <画像パス> "キャプション"');
  process.exit(1);
}

const imagePath = args[0];
const caption = args[1];

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像ファイルが見つかりません: ${imagePath}`);
  process.exit(1);
}

// 実行
postToInstagram(imagePath, caption)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ 投稿失敗:', err);
    process.exit(1);
  });
