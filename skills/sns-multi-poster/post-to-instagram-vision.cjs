#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Vision API統合版
 * ハイブリッド方式: Vision API → セレクタフォールバック
 * 
 * Usage: node post-to-instagram-vision.cjs <video_path> <caption>
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const visionHelper = require('./vision-helper.cjs');

puppeteer.use(StealthPlugin());

const [,, videoPath, caption] = process.argv;

if (!videoPath || !caption) {
  console.error('使い方: node post-to-instagram-vision.cjs <video_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(videoPath)) {
  console.error(`❌ 動画が見つかりません: ${videoPath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const DEBUG_DIR = '/tmp/instagram-vision-debug';

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
 * @param {string} detailedDescription - Vision API用の詳細な説明（オプション）
 */
async function hybridClick(page, targetText, fallbackSelectors = [], timeout = 30000, detailedDescription = null) {
  console.log(`\n🎯 "${targetText}" をクリック試行（ハイブリッド方式）`);
  if (detailedDescription) {
    console.log(`📝 詳細説明: "${detailedDescription}"`);
  }
  
  // スクリーンショット撮影
  const screenshotPath = await takeScreenshot(page, `before-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  
  // Vision API試行（詳細説明があればそれを使う）
  const visionResult = await visionHelper.detectUIElement(
    screenshotPath, 
    detailedDescription || targetText, 
    {
      debug: true,
      maxRetries: 2
    }
  );
  
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
      const elements = Array.from(document.querySelectorAll('button, [role="button"], a, span'));
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
    console.log('🔄 DRY RUN: Instagram投稿スキップ');
    console.log(`🎥 動画: ${videoPath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
    console.log('✅ DRY RUN完了（実際の投稿なし）');
    return;
  }

  console.log('🎥 Instagram Vision投稿開始');
  console.log(`📹 ${videoPath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);
  console.log(`🔍 Vision API統合モード`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // ─── Step 1: Cookie設定 ───
    console.log('\n🔐 Step 1: Cookie設定...');
    const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    const cookies = rawCookies.map(c => {
      const cookie = {
        name: c.name,
        value: decodeURIComponent(c.value),
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
      };
      const sm = c.sameSite;
      if (sm === 'no_restriction') cookie.sameSite = 'None';
      else if (sm === 'lax') cookie.sameSite = 'Lax';
      else if (sm === 'strict') cookie.sameSite = 'Strict';
      else cookie.sameSite = 'None';
      const exp = c.expirationDate || c.expires;
      if (exp) cookie.expires = Math.floor(exp);
      return cookie;
    });
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // ─── Step 2: Instagram移動 ───
    console.log('\n🌐 Step 2: Instagram移動...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 180000 });
    console.log('✅ ページ読み込み完了');
    
    await new Promise(r => setTimeout(r, 5000));
    await takeScreenshot(page, 'page-loaded');

    // ─── Step 3: ログイン確認 ───
    console.log('\n🔑 Step 3: ログイン確認...');
    const url = page.url();
    if (url.includes('/accounts/login')) {
      console.error('❌ ログインが必要です（Cookie無効）');
      throw new Error('Login required');
    }
    console.log('✅ ログイン確認完了');

    // ─── Step 4: 新規投稿ボタン（Vision） ───
    console.log('\n➕ Step 4: 新規投稿ボタン...');
    const createSuccess = await hybridClick(
      page, 
      'Create', 
      [
        'svg[aria-label="New post"]',
        'svg[aria-label="新規投稿"]',
        '[aria-label="New post"]',
        '[aria-label="新規投稿"]',
        'svg[aria-label="Create"]',
      ],
      30000,
      'Create button with plus icon in the left sidebar'
    );
    
    if (!createSuccess) {
      throw new Error('新規投稿ボタンが見つかりません');
    }
    
    await new Promise(r => setTimeout(r, 3000));

    // ─── Step 5: Postサブメニュー（Vision） ───
    console.log('\n📋 Step 5: Postサブメニュー...');
    await hybridClick(
      page, 
      'Post', 
      [
        '[role="menuitem"]',
        'button:has-text("Post")',
        'a:has-text("Post")',
      ],
      30000,
      'Post menu item in the left sidebar, below Notifications'
    );
    
    await new Promise(r => setTimeout(r, 5000));

    // ─── Step 6: 動画アップロード ───
    console.log('\n📤 Step 6: 動画アップロード...');
    await takeScreenshot(page, 'before-upload');
    
    let fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.log('📋 Select from computer...');
      try {
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex]'));
            for (const btn of btns) {
              const txt = btn.textContent?.trim() || '';
              if (txt.toLowerCase().includes('select from computer') ||
                  txt.includes('コンピューターから選択')) {
                btn.click();
                return true;
              }
            }
            return false;
          })
        ]);
        await fileChooser.accept([videoPath]);
        console.log('✅ FileChooser経由でアップロード');
      } catch (fcErr) {
        console.log(`⚠️  FileChooser失敗: ${fcErr.message}`);
        fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
          throw new Error('ファイル入力なし');
        }
        await fileInput.uploadFile(videoPath);
      }
    } else {
      await fileInput.uploadFile(videoPath);
    }
    
    console.log('✅ アップロード完了');
    await new Promise(r => setTimeout(r, 10000));
    await takeScreenshot(page, 'after-upload');

    // ─── Step 7: Next × 2（Vision） ───
    for (let i = 1; i <= 2; i++) {
      console.log(`\n⏭️  Step ${6 + i}: Next (${i}/2)...`);
      const nextSuccess = await hybridClick(
        page, 
        'Next', 
        [
          'button:has-text("Next")',
          'button:has-text("次へ")',
          '[role="button"]:has-text("Next")',
        ],
        30000,
        'Next button in the bottom right corner'
      );
      
      if (!nextSuccess) {
        throw new Error(`次へボタン ${i} が見つかりません`);
      }
      
      await new Promise(r => setTimeout(r, 3000));
    }

    // ─── Step 9: キャプション（Vision） ───
    console.log('\n📝 Step 9: キャプション...');
    await takeScreenshot(page, 'before-caption');
    
    const captionSelectors = [
      'div[aria-label*="caption" i][contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[aria-placeholder*="Write a caption"]',
    ];
    
    let captionEl = null;
    for (const sel of captionSelectors) {
      captionEl = await page.$(sel);
      if (captionEl) break;
    }
    
    if (captionEl) {
      await captionEl.click();
      await new Promise(r => setTimeout(r, 500));
      await captionEl.type(caption, { delay: 20 });
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力エリアなし（投稿は続行）');
    }
    
    await takeScreenshot(page, 'after-caption');

    // ─── Step 10: Share（Vision） ───
    console.log('\n🚀 Step 10: Share...');
    const shareSuccess = await hybridClick(
      page, 
      'Share', 
      [
        'button:has-text("Share")',
        'button:has-text("シェア")',
        '[role="button"]:has-text("Share")',
      ],
      30000,
      'Share button in the bottom right corner of the caption dialog'
    );
    
    if (!shareSuccess) {
      throw new Error('Shareボタンが見つかりません');
    }

    // ─── Step 11: 投稿完了待機 ───
    console.log('\n⏳ Step 11: 投稿完了待機（最大60秒）...');
    const t0 = Date.now();
    const TIMEOUT = 60000;
    
    let completed = false;
    while (Date.now() - t0 < TIMEOUT) {
      const sharingDialog = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h2, h3, [role="heading"]'));
        return headings.some(h => h.textContent?.trim() === 'Sharing');
      });
      
      if (!sharingDialog) {
        completed = true;
        console.log('✅ 投稿完了！');
        break;
      }
      
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`⏳ 投稿処理中... (${elapsed}秒経過)`);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    await takeScreenshot(page, 'final');
    
    if (!completed) {
      console.error('❌ タイムアウト: 投稿が60秒以内に完了しませんでした');
      throw new Error('Post timeout');
    }

    console.log('\n🎉 Instagram Vision投稿完了！');
    console.log(`📁 デバッグファイル: ${DEBUG_DIR}`);

  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
