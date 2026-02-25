#!/usr/bin/env node
/**
 * Pinterest 投稿スクリプト - Vision API統合版
 * ハイブリッド方式: Vision API → セレクタフォールバック
 * 
 * Usage: node post-to-pinterest-vision.cjs <image_path> <caption> [board_name]
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const visionHelper = require('./vision-helper-claude.cjs');

puppeteer.use(StealthPlugin());

const imagePath = process.argv[2];
const caption = process.argv[3];
const boardName = process.argv[4] || 'Animal'; // デフォルト: "Animal"

if (!imagePath || !caption) {
  console.error('使い方: node post-to-pinterest-vision.cjs <image_path> <caption> [board_name]');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/pinterest.json');
const DEBUG_DIR = '/tmp/pinterest-vision-debug';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// ステップカウンター
let stepCounter = 1;

/**
 * スクリーンショット撮影ヘルパー
 */
async function takeScreenshot(page, description) {
  const filename = `${String(stepCounter).padStart(2, '0')}-${description}.png`;
  const filepath = path.join(DEBUG_DIR, filename);
  console.log(`📸 スクリーンショット: ${filepath}`);
  await page.screenshot({ path: filepath });
  stepCounter++;
  return filepath;
}

/**
 * ハイブリッド方式でUI要素をクリック
 * @param {Object} page - Puppeteer page
 * @param {string} targetText - 検出したいテキスト
 * @param {Array<string>} fallbackSelectors - フォールバックセレクタ
 * @param {number} timeout - タイムアウト（ミリ秒）
 */
async function hybridClick(page, targetText, fallbackSelectors = [], timeout = 30000) {
  console.log(`\n🎯 "${targetText}" をクリック試行（ハイブリッド方式）`);
  
  // スクリーンショット撮影
  const screenshotPath = await takeScreenshot(page, `before-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  
  // Vision API試行
  const visionResult = await visionHelper.detectUIElement(screenshotPath, targetText, {
    debug: true,
    maxRetries: 2
  });
  
  if (visionResult && visionResult.confidence > 0.6) {
    console.log(`✅ Vision検出成功: (${visionResult.x}, ${visionResult.y})`);
    
    // デバッグオーバーレイ作成
    const overlayPath = path.join(DEBUG_DIR, `overlay-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
    await visionHelper.drawDebugOverlay(screenshotPath, [visionResult], overlayPath);
    
    // 座標クリック
    try {
      await page.mouse.click(visionResult.x, visionResult.y);
      console.log(`✅ Vision座標でクリック成功`);
      await new Promise(r => setTimeout(r, 2000));
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-vision`);
      return true;
    } catch (err) {
      console.error(`❌ Vision座標クリック失敗: ${err.message}`);
    }
  }
  
  // フォールバック: セレクタ方式
  console.log(`⚠️  Vision失敗 → セレクタフォールバック`);
  
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    // セレクタで検索
    for (const selector of fallbackSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, element);
          
          if (isVisible) {
            console.log(`✅ セレクタ検出: ${selector}`);
            await element.click();
            console.log(`✅ セレクタでクリック成功`);
            await new Promise(r => setTimeout(r, 2000));
            await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-selector`);
            return true;
          }
        }
      } catch (err) {
        // 次のセレクタを試行
      }
    }
    
    // テキストベース検索（最終フォールバック）
    const clicked = await page.evaluate((texts) => {
      const elements = Array.from(document.querySelectorAll('button, [role="button"], div[data-test-id*="button"]'));
      for (const el of elements) {
        const text = el.textContent?.trim().toLowerCase();
        if (texts.some(t => text.includes(t.toLowerCase()))) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            el.click();
            return el.textContent.trim();
          }
        }
      }
      return null;
    }, [targetText]);
    
    if (clicked) {
      console.log(`✅ テキストベースでクリック: "${clicked}"`);
      await new Promise(r => setTimeout(r, 2000));
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-text`);
      return true;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.error(`❌ タイムアウト: "${targetText}" が見つかりません`);
  await takeScreenshot(page, `error-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  return false;
}

async function main() {
  // DRY RUN チェック
  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Pinterest投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log(`📌 ボード: ${boardName}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  console.log('📌 Pinterest Vision投稿開始');
  console.log(`📷 ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);
  console.log(`📂 ボード: ${boardName}`);
  console.log(`🔍 Vision API統合モード`);

  // キャプションから title と description を分離
  const lines = caption.split('\n').filter(line => line.trim());
  const title = lines[0] || caption.substring(0, 100);
  const description = caption;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // ─── Step 1: Cookie設定 ───
    console.log('\n🔐 Step 1: Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.pinterest.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // ─── Step 2: Pinterest移動 ───
    console.log('\n🌐 Step 2: Pinterest移動...');
    await page.goto('https://jp.pinterest.com/pin-creation-tool/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 120000 
    });
    console.log('✅ ページ読み込み完了');

    await new Promise(r => setTimeout(r, 8000));
    await takeScreenshot(page, 'page-loaded');

    // ログイン確認
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      await takeScreenshot(page, 'login-error');
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');

    // ─── Step 3: ファイルアップロード ───
    console.log('\n📤 Step 3: ファイルアップロード...');
    await takeScreenshot(page, 'before-upload');
    
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
          console.log(`✅ ファイル入力発見: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️  ファイル入力失敗: ${selector}`);
      }
    }
    
    if (!fileInput) {
      await takeScreenshot(page, 'error-no-file-input');
      throw new Error('ファイル入力なし');
    }
    
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');
    
    await new Promise(r => setTimeout(r, 5000));
    await takeScreenshot(page, 'after-upload');

    // ─── Step 4: タイトル入力 ───
    console.log('\n📝 Step 4: タイトル入力...');
    await takeScreenshot(page, 'before-title');
    
    const titleSelectors = [
      '[data-test-id="pin-draft-title"]',
      'input[placeholder*="タイトル"]',
      'input[placeholder*="Add a title"]',
      '[aria-label*="タイトル"]',
      '[aria-label*="title"]'
    ];

    let titleInput = null;
    for (const selector of titleSelectors) {
      titleInput = await page.$(selector);
      if (titleInput) {
        console.log(`✅ タイトル入力欄発見: ${selector}`);
        break;
      }
    }
    
    if (titleInput) {
      await titleInput.click();
      await new Promise(r => setTimeout(r, 500));
      await titleInput.type(title, { delay: 50 });
      console.log('✅ タイトル入力完了');
    } else {
      console.warn('⚠️  タイトル入力欄なし');
    }
    
    await takeScreenshot(page, 'after-title');

    // ─── Step 5: 説明文入力 ───
    console.log('\n📝 Step 5: 説明文入力...');
    const descSelectors = [
      '[data-test-id="pin-draft-description"]',
      'textarea[placeholder*="説明"]',
      'textarea[placeholder*="description"]',
      '[aria-label*="説明"]'
    ];

    let descInput = null;
    for (const selector of descSelectors) {
      descInput = await page.$(selector);
      if (descInput) {
        console.log(`✅ 説明入力欄発見: ${selector}`);
        break;
      }
    }
    
    if (descInput) {
      await descInput.click();
      await new Promise(r => setTimeout(r, 500));
      await descInput.type(description, { delay: 30 });
      console.log('✅ 説明入力完了');
    } else {
      console.warn('⚠️  説明入力欄なし');
    }
    
    await takeScreenshot(page, 'after-description');

    // ─── Step 6: ボード選択（Vision） ───
    console.log('\n📂 Step 6: ボード選択...');
    await hybridClick(page, boardName, [
      `[data-test-id="board-dropdown-select-button"]`,
      `button:has-text("${boardName}")`,
      `[aria-label*="${boardName}"]`,
    ]);
    
    await new Promise(r => setTimeout(r, 2000));

    // ─── Step 7: Publish（Vision） ───
    console.log('\n🚀 Step 7: Publish...');
    const publishSuccess = await hybridClick(page, 'Publish', [
      '[data-test-id="board-dropdown-save-button"]',
      'button:has-text("Publish")',
      'button:has-text("公開")',
      '[aria-label="Publish"]',
    ]);
    
    if (!publishSuccess) {
      throw new Error('Publishボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');
    await new Promise(r => setTimeout(r, 8000));
    await takeScreenshot(page, 'final');

    console.log('\n🎉 Pinterest Vision投稿完了！');
    console.log(`📁 デバッグファイル: ${DEBUG_DIR}`);

  } catch (error) {
    console.error('❌ エラー発生:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
