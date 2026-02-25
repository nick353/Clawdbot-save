#!/usr/bin/env node
/**
 * X (Twitter) 投稿スクリプト - Vision API統合版
 * ハイブリッド方式: Vision API → セレクタフォールバック
 * 
 * Usage: node post-to-x-vision.cjs <image_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const visionHelper = require('./vision-helper-claude.cjs');

const {
  checkRateLimit,
  logPost,
  randomDelay,
  getRandomUserAgent,
  bypassChromeDetection,
  config,
} = require('./lib/anti-ban-helpers.js');

puppeteer.use(StealthPlugin());

const [,, imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-x-vision.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/x.json');
const DEBUG_DIR = '/tmp/x-vision-debug';

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
            await randomDelay(1000, 2000);
            await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-selector`);
            return true;
          }
        }
      } catch (err) {
        // 次のセレクタを試行
      }
    }
    
    // XPath検索（最終フォールバック）
    const clicked = await page.evaluate((texts) => {
      const xpathResult = document.evaluate(
        `//button[contains(., '${texts[0]}')] | //div[@role='button' and contains(., '${texts[0]}')]`,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = xpathResult.singleNodeValue;
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          element.click();
          return element.textContent.trim();
        }
      }
      return null;
    }, [targetText]);
    
    if (clicked) {
      console.log(`✅ XPathでクリック: "${clicked}"`);
      await randomDelay(1000, 2000);
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-xpath`);
      return true;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.error(`❌ タイムアウト: "${targetText}" が見つかりません`);
  await takeScreenshot(page, `error-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  return false;
}

async function main() {
  console.log('🛡️  BAN対策チェック (X)...');

  // DRY RUN チェック
  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: X投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  if (!(await checkRateLimit('x'))) {
    console.error('❌ レート制限超過（X: 10投稿/時間、100投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('🐦 X Vision投稿開始');
  console.log(`📷 ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);
  console.log(`🔍 Vision API統合モード`);

  const userAgent = getRandomUserAgent();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: config.browserArgs,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(userAgent);
    await bypassChromeDetection(page);
    await page.emulateTimezone('Asia/Tokyo');

    // ─── Step 1: Cookie設定 ───
    console.log('\n🔐 Step 1: Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.x.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    await randomDelay(2000, 5000);

    // ─── Step 2: X移動 ───
    console.log('\n🌐 Step 2: X移動...');
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ ページ読み込み完了');

    // 追加待機（ページが完全に表示されるまで）
    await randomDelay(10000, 15000);
    await takeScreenshot(page, 'page-loaded');

    // ─── Step 3: ツイート入力 ───
    console.log('\n📝 Step 3: ツイート入力...');
    const tweetBoxSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="What is happening"]',
      'textarea[placeholder*="happening" i]'
    ];

    let tweetBox = null;
    for (const selector of tweetBoxSelectors) {
      tweetBox = await page.$(selector);
      if (tweetBox) {
        console.log(`✅ ツイート入力欄を発見: ${selector}`);
        break;
      }
    }

    if (!tweetBox) {
      await takeScreenshot(page, 'error-no-input');
      throw new Error('ツイート入力欄が見つかりません');
    }

    await takeScreenshot(page, 'before-input');
    await tweetBox.click();
    await randomDelay(500, 1000);

    for (const char of caption) {
      await page.keyboard.type(char);
      await randomDelay(50, 150);
    }
    console.log('✅ ツイート入力完了');

    await randomDelay(1000, 2000);
    await takeScreenshot(page, 'after-input');

    // ─── Step 4: 画像アップロード ───
    console.log('\n📷 Step 4: 画像アップロード...');
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) {
      await takeScreenshot(page, 'error-no-file-input');
      throw new Error('ファイル入力なし');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ 画像アップロード完了');

    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'after-upload');

    // ─── Step 5: Post（Vision） ───
    console.log('\n📤 Step 5: Post...');
    const postSuccess = await hybridClick(page, 'Post', [
      'button[data-testid="tweetButton"]',
      'button[data-testid="tweetButtonInline"]',
      'div[data-testid="tweetButton"]',
      'div[role="button"][data-testid="tweetButton"]',
      'button[role="button"][data-testid="tweetButton"]'
    ]);
    
    if (!postSuccess) {
      throw new Error('Postボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');
    await randomDelay(8000, 12000);
    await takeScreenshot(page, 'final');

    await logPost('x');
    console.log('\n🎉 X Vision投稿完了！');
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
