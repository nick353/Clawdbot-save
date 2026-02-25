#!/usr/bin/env node
/**
 * Facebook 投稿スクリプト - Vision API統合版
 * ハイブリッド方式: Vision API → セレクタフォールバック
 * 
 * Usage: node post-to-facebook-vision.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const visionHelper = require('./vision-helper.cjs');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-facebook-vision.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/facebook.json');
const DEBUG_DIR = '/tmp/facebook-vision-debug';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// ステップカウンター
let stepCounter = 1;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return sleep(Math.floor(Math.random() * (max - min + 1) + min)); }

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
      await randomDelay(1000, 2000);
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
        const elements = await page.$$(selector);
        for (const element of elements) {
          const isVisible = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, element);
          
          if (isVisible) {
            console.log(`✅ セレクタ検出: ${selector}`);
            await element.click();
            console.log(`✅ セレクタでクリック成功`);
            await randomDelay(1000, 2000);
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
      const elements = Array.from(document.querySelectorAll('[role="button"], button, a'));
      for (const el of elements) {
        const text = el.textContent?.trim().toLowerCase();
        const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
        if (texts.some(t => text.includes(t.toLowerCase()) || aria.includes(t.toLowerCase()))) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            el.click();
            return el.textContent.trim() || el.getAttribute('aria-label');
          }
        }
      }
      return null;
    }, [targetText]);
    
    if (clicked) {
      console.log(`✅ テキストベースでクリック: "${clicked}"`);
      await randomDelay(1000, 2000);
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
    console.log('🔄 DRY RUN: Facebook投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  console.log('📘 Facebook Vision投稿開始');
  console.log(`🖼️  ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);
  console.log(`🔍 Vision API統合モード`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900','--disable-blink-features=AutomationControlled']
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    // ─── Step 1: Cookie設定 ───
    console.log('\n🔐 Step 1: Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.facebook.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // ─── Step 2: Facebook移動 ───
    console.log('\n🌐 Step 2: Facebook移動...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await randomDelay(3000, 5000);
    
    const currentUrl = page.url();
    console.log(`📍 URL: ${currentUrl}`);
    if (currentUrl.includes('/login')) {
      await takeScreenshot(page, 'login-error');
      throw new Error('ログイン必要 - Cookie期限切れの可能性があります');
    }
    console.log('✅ ログイン確認完了');
    await takeScreenshot(page, 'page-loaded');

    // ─── Step 3: 投稿エリアクリック（Vision） ───
    console.log('\n📝 Step 3: 投稿エリアを開く...');
    const modalSuccess = await hybridClick(page, "What's on your mind", [
      '[aria-label*="Create a post"]',
      '[aria-label*="Write something"]',
      '[role="button"]:has-text("What\'s on your mind")',
    ]);
    
    if (!modalSuccess) {
      console.warn('⚠️  投稿エリアボタン検出失敗（続行）');
    }
    
    await randomDelay(3000, 5000);

    // ─── Step 4: Photo/videoボタン（Vision） ───
    console.log('\n📷 Step 4: 写真追加...');
    await hybridClick(page, 'Photo/video', [
      '[aria-label="Photo/video"]',
      '[aria-label="写真/動画"]',
      '[role="button"]:has-text("Photo")',
    ]);
    
    await randomDelay(2000, 4000);

    // ─── Step 5: ファイルアップロード ───
    console.log('\n📤 Step 5: ファイルアップロード...');
    await takeScreenshot(page, 'before-upload');
    
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) {
      await takeScreenshot(page, 'error-no-file-input');
      throw new Error('ファイル入力なし');
    }
    
    await fileInput.uploadFile(imagePath);
    console.log('✅ ファイルアップロード完了');
    
    await randomDelay(5000, 7000);
    await takeScreenshot(page, 'after-upload');

    // ─── Step 6: キャプション入力 ───
    console.log('\n📝 Step 6: キャプション...');
    await takeScreenshot(page, 'before-caption');
    
    const textArea = await page.$('[role="textbox"], [contenteditable="true"]');
    if (textArea) {
      await textArea.click();
      await randomDelay(500, 1000);
      await textArea.type(caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力欄なし');
    }
    
    await randomDelay(2000, 3000);
    await takeScreenshot(page, 'after-caption');

    // ─── Step 7: Post（Vision） ───
    console.log('\n🚀 Step 7: Post...');
    const postSuccess = await hybridClick(page, 'Post', [
      '[aria-label="Post"]',
      '[aria-label="投稿"]',
      'button:has-text("Post")',
      '[role="button"]:has-text("Post")',
    ]);
    
    if (!postSuccess) {
      throw new Error('Postボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');
    await randomDelay(8000, 12000);
    await takeScreenshot(page, 'final');

    console.log('\n🎉 Facebook Vision投稿完了！');
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
