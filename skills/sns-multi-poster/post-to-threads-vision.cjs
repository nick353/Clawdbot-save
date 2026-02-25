#!/usr/bin/env node
/**
 * Threads 投稿スクリプト - Vision API統合版
 * ハイブリッド方式: Vision API → セレクタフォールバック
 * 
 * Usage: node post-to-threads-vision.cjs <image_path> <caption>
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
  console.error('使い方: node post-to-threads-vision.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/threads.json');
const DEBUG_DIR = '/tmp/threads-vision-debug';

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
  
  if (visionResult && visionResult.confidence > 0.7) {
    console.log(`✅ Claude Vision検出成功: (${visionResult.x}, ${visionResult.y}, 確信度:${visionResult.confidence})`);
    
    // デバッグオーバーレイ作成
    const overlayPath = path.join(DEBUG_DIR, `overlay-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
    await visionHelper.drawDebugOverlay(screenshotPath, [visionResult], overlayPath);
    
    // 座標クリック（テキスト部分を正確にクリック）
    try {
      console.log(`🎯 テキスト「${targetText}」の中心座標をクリック: (${visionResult.x}, ${visionResult.y})`);
      await page.mouse.click(visionResult.x, visionResult.y);
      console.log(`✅ Claude Vision座標でクリック成功`);
      await randomDelay(1000, 2000);
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-vision`);
      return true;
    } catch (err) {
      console.error(`❌ Vision座標クリック失敗: ${err.message}`);
    }
  } else if (visionResult) {
    console.log(`⚠️  Claude Vision検出成功だが確信度低い: ${visionResult.confidence} < 0.7 → セレクタフォールバック`);
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
    
    // XPath検索（最終フォールバック - テキストノード直接検索）
    const clicked = await page.evaluate((texts) => {
      // テキストノードを直接検索
      const xpathQueries = [
        `//button[contains(text(), '${texts[0]}')]`,
        `//div[@role='button' and contains(text(), '${texts[0]}')]`,
        `//button[contains(., '${texts[0]}')]`,
        `//div[@role='button' and contains(., '${texts[0]}')]`,
        `//*[text()='${texts[0]}']`, // 完全一致
      ];
      
      for (const query of xpathQueries) {
        const xpathResult = document.evaluate(
          query,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const element = xpathResult.singleNodeValue;
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            console.log(`✅ XPath検出: ${query}`);
            element.click();
            return element.textContent.trim();
          }
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
  console.log('🛡️  BAN対策チェック (Threads)...');

  // DRY RUN チェック
  if (process.env.DRY_RUN === 'true') {
    console.log('🔄 DRY RUN: Threads投稿スキップ');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  if (!(await checkRateLimit('threads'))) {
    console.error('❌ レート制限超過（Threads: 4投稿/時間、25投稿/日）');
    process.exit(1);
  }

  console.log('✅ BAN対策チェック完了\n');
  console.log('📸 Threads Vision投稿開始');
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
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // ─── Step 1: Cookie設定 ───
    console.log('\n🔐 Step 1: Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.threads.net',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'None'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    await randomDelay(2000, 5000);

    // ─── Step 2: Threads移動 ───
    console.log('\n🌐 Step 2: Threads移動...');
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('✅ ページ読み込み完了');

    await randomDelay(8000, 12000);
    await takeScreenshot(page, 'page-loaded');

    // ─── Step 3: Create（Vision） ───
    console.log('\n➕ Step 3: 新規投稿ボタン...');
    const createSuccess = await hybridClick(page, 'Create', [
      'svg[aria-label="Create"]',
      '[aria-label="Create"]',
      'svg[aria-label="新規投稿"]',
      '[aria-label="新規投稿"]',
    ]);
    
    if (!createSuccess) {
      throw new Error('Createボタンが見つかりません');
    }
    
    await randomDelay(2000, 4000);

    // ─── Step 4: ファイルアップロード ───
    console.log('\n📷 Step 4: ファイルアップロード...');
    await takeScreenshot(page, 'before-upload');
    
    const fileSelectors = [
      'input[type="file"]',
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="video"]',
      'input[accept="image/*,video/*"]',
      '[data-testid="file-upload-input"]',
      'input[name="file"]',
      'input[style*="hidden"]',
    ];

    let fileInput = null;
    for (const selector of fileSelectors) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ ファイル入力発見: ${selector}`);
        break;
      }
      await randomDelay(1000, 2000);
    }

    if (!fileInput) {
      fileInput = await page.evaluateHandle(() => document.querySelector('input[type="file"]'));
      if (!fileInput) {
        await takeScreenshot(page, 'error-no-file-input');
        throw new Error('ファイル入力なし');
      }
      console.log('✅ ファイル入力発見: evaluate');
    }

    await fileInput.uploadFile(imagePath);
    console.log('✅ ファイルアップロード完了');

    await randomDelay(4000, 6000);
    await takeScreenshot(page, 'after-upload');

    // ─── Step 5: キャプション入力 ───
    console.log('\n📝 Step 5: キャプション...');
    await takeScreenshot(page, 'before-caption');
    
    const textArea = await page.$('div[contenteditable="true"], textarea[placeholder*="thread"]');
    if (textArea) {
      await textArea.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ キャプション入力完了');
    } else {
      console.log('⚠️  キャプション入力欄なし（投稿は続行）');
    }

    await randomDelay(2000, 4000);
    await takeScreenshot(page, 'after-caption');

    // ─── Step 6: Post（Vision） ───
    console.log('\n📤 Step 6: Post...');
    const postSuccess = await hybridClick(page, 'Post', [
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("投稿")',
      'button:has-text("Post")',
      'button:has-text("投稿")',
      '[aria-label*="Post"]',
      '[aria-label*="投稿"]',
      'div[role="button"]', // 汎用フォールバック
    ]);
    
    if (!postSuccess) {
      throw new Error('Postボタンが見つかりません');
    }

    console.log('✅ 投稿完了待機中...');
    await randomDelay(10000, 15000);
    await takeScreenshot(page, 'final');

    await logPost('threads');
    console.log('\n🎉 Threads Vision投稿完了！');
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
