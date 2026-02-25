#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// 引数チェック
if (process.argv.length < 4) {
  console.error('使い方: node post-to-instagram-vision-v2.cjs <動画パス> <キャプション>');
  process.exit(1);
}

const videoPath = process.argv[2];
const caption = process.argv[3];

// 設定
const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const DEBUG_DIR = '/tmp/instagram-vision-debug';
const INSTAGRAM_URL = 'https://www.instagram.com/';

// Vision API設定
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_VISION = !!GEMINI_API_KEY;

if (!USE_VISION) {
  console.log('⚠️  GEMINI_API_KEY未設定 → セレクタモードのみ');
}

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// スクリーンショットカウンター
let stepCounter = 1;

async function takeScreenshot(page, description) {
  const filename = `${String(stepCounter).padStart(2, '0')}-${description}.png`;
  const filepath = path.join(DEBUG_DIR, filename);
  console.log(`📸 スクリーンショット: ${filepath}`);
  await page.screenshot({ path: filepath, fullPage: false });
  stepCounter++;
  return filepath;
}

// ランダム遅延
async function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(r => setTimeout(r, delay));
}

// Gemini Vision API呼び出し
async function detectWithGemini(screenshotPath, targetDescription, maxRetries = 2) {
  if (!USE_VISION) return null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔍 Gemini Vision API呼び出し (試行 ${attempt}/${maxRetries}): "${targetDescription}"`);
    
    try {
      const imageBuffer = fs.readFileSync(screenshotPath);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `あなたはUI要素検出の専門家です。以下の画像から、指定されたUI要素を探して、その座標を返してください。

**重要なルール:**
1. **テキストラベル優先**: ボタンやメニュー項目の「テキストラベル」を最優先で探す
2. **バッジ・カウンターは無視**: "Post (98%)" のようなバッジやカウンター表示は対象外
3. **位置情報を活用**: プロンプトに位置情報（例: "in the left sidebar", "below Notifications"）がある場合は、その領域内で探す
4. **正確な座標**: 要素の中心座標（ピクセル単位）を返す

**検出対象:**
${targetDescription}

**応答形式（JSON）:**
{
  "found": true/false,
  "x": <X座標>,
  "y": <Y座標>,
  "confidence": <0.0-1.0>,
  "text": "<検出したテキスト>",
  "reason": "<見つからなかった場合の理由>"
}` },
                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: imageBase64
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              topK: 40
            }
          })
        }
      );

      const result = await response.json();
      
      if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        const jsonText = result.candidates[0].content.parts[0].text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        console.log(`📥 Gemini Vision API応答: ${jsonText}`);
        
        const detected = JSON.parse(jsonText);
        
        if (detected.found) {
          console.log(`✅ Gemini Vision API: "${targetDescription}" 検出成功 (x:${detected.x}, y:${detected.y}, 確信度:${detected.confidence})`);
          return detected;
        } else {
          console.log(`⚠️  Gemini Vision API: "${targetDescription}" が見つかりませんでした（${detected.reason}）`);
        }
      }
    } catch (error) {
      console.error(`❌ Gemini Vision API呼び出しエラー (試行 ${attempt}/${maxRetries}):`, error.message);
      if (attempt < maxRetries) {
        await randomDelay(2000, 3000);
      }
    }
  }
  
  return null;
}

// デバッグオーバーレイ作成
async function drawDebugOverlay(screenshotPath, detections, outputPath) {
  // 簡易実装（実際はImageMagickやCanvas使用）
  console.log(`📸 デバッグオーバーレイ保存: ${outputPath}`);
  fs.copyFileSync(screenshotPath, outputPath);
}

// ハイブリッドクリック（Vision API + セレクタフォールバック）
async function hybridClick(page, targetText, targetDescription, fallbackSelectors = [], timeout = 30000) {
  console.log(`\n🎯 "${targetText}" をクリック試行（ハイブリッド方式）`);
  if (targetDescription) {
    console.log(`📝 詳細説明: "${targetDescription}"`);
  }
  
  const startTime = Date.now();
  
  // スクリーンショット撮影
  const screenshotPath = await takeScreenshot(page, `before-${targetText.toLowerCase().replace(/\s+/g, '-')}`);
  
  // Vision API試行
  if (USE_VISION && targetDescription) {
    const visionResult = await detectWithGemini(screenshotPath, targetDescription);
    
    if (visionResult && visionResult.confidence > 0.6) {
      console.log(`✅ Vision検出成功: (${visionResult.x}, ${visionResult.y})`);
      
      // デバッグオーバーレイ作成
      const overlayPath = path.join(DEBUG_DIR, `overlay-${targetText.toLowerCase().replace(/\s+/g, '-')}.png`);
      await drawDebugOverlay(screenshotPath, [visionResult], overlayPath);
      
      // 座標クリック
      try {
        await page.mouse.click(visionResult.x, visionResult.y);
        console.log(`✅ Vision座標でクリック成功`);
        await randomDelay(1000, 2000);
        await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-vision`);
        return true;
      } catch (err) {
        console.error(`❌ Vision座標クリック失敗:`, err.message);
      }
    } else {
      console.log(`⚠️  Vision失敗 → セレクタフォールバック`);
    }
  }
  
  // セレクタフォールバック
  while (Date.now() - startTime < timeout) {
    for (const selector of fallbackSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ セレクタ検出: ${selector}`);
          await element.click();
          console.log(`✅ セレクタでクリック成功`);
          await randomDelay(1000, 2000);
          await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-selector`);
          return true;
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
      await randomDelay(2000, 3000);
      await takeScreenshot(page, `after-${targetText.toLowerCase().replace(/\s+/g, '-')}-text`);
      return true;
    }
    
    await randomDelay(1000, 2000);
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
  console.log(`🔍 Vision API統合モード${USE_VISION ? '' : '（無効）'}`);

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

    // Cookie設定
    console.log('\n🔐 Step 1: Cookie設定...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
        name: c.name,
        value: decodeURIComponent(c.value),
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
        expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
      }));
      await page.setCookie(...cookies);
      console.log(`✅ Cookie設定完了 (${cookies.length}件)`);
    } else {
      console.error('❌ Cookieファイルなし');
      process.exit(1);
    }

    // Instagram移動
    console.log('\n🌐 Step 2: Instagram移動...');
    await page.goto(INSTAGRAM_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'page-loaded');
    console.log('✅ ページ読み込み完了');

    // ログイン確認
    console.log('\n🔑 Step 3: ログイン確認...');
    const url = page.url();
    if (url.includes('/accounts/login')) {
      console.error('❌ ログインが必要です（Cookie無効）');
      process.exit(1);
    }
    console.log('✅ ログイン確認完了');

    // Create ボタンクリック
    console.log('\n➕ Step 4: 新規投稿ボタン...');
    const createClicked = await hybridClick(
      page,
      'Create',
      'Create button with plus icon in the left sidebar',
      [
        'svg[aria-label="New post"]',
        'svg[aria-label="新規投稿"]',
        '[role="menuitem"]:has-text("Create")',
        'a[href="#"]'
      ]
    );
    
    if (!createClicked) {
      console.error('❌ Createボタンが見つかりません');
      process.exit(1);
    }

    // ダイアログ表示待機（重要！）
    console.log('\n⏳ ダイアログ表示待機...');
    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'after-create-dialog');

    // Post サブメニュークリック
    console.log('\n📋 Step 5: Postサブメニュー...');
    const postClicked = await hybridClick(
      page,
      'Post',
      'Post menu item in the create dialog, the first option in the list',
      [
        'button:has-text("Post")',
        'div[role="menuitem"]:has-text("Post")',
        'span:has-text("Post")',
        '//button[contains(., "Post") and not(contains(., "%"))]',
        '//div[@role="menuitem"][contains(., "Post")]'
      ]
    );
    
    if (!postClicked) {
      console.error('❌ Postサブメニューが見つかりません');
      process.exit(1);
    }

    // ダイアログ表示待機（重要！）
    console.log('\n⏳ アップロードダイアログ表示待機...');
    await randomDelay(5000, 7000);
    await takeScreenshot(page, 'upload-dialog');

    // ファイルアップロード
    console.log('\n📤 Step 6: 動画アップロード...');
    await takeScreenshot(page, 'before-upload');
    
    // アプローチ1: FileChooser方式（タイムアウト延長）
    console.log('📋 FileChooser方式試行...');
    try {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 30000 }), // 15秒 → 30秒に延長
        page.click('button:has-text("Select from computer"), button:has-text("コンピューターから選択")').catch(() => 
          page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const selectBtn = btns.find(b => b.textContent.includes('Select from computer') || b.textContent.includes('コンピューターから選択'));
            if (selectBtn) selectBtn.click();
          })
        )
      ]);
      
      await fileChooser.accept([videoPath]);
      console.log('✅ FileChooser方式成功');
    } catch (err) {
      console.log(`⚠️  FileChooser失敗: ${err.message}`);
      
      // アプローチ2: ファイル入力直接操作
      console.log('📋 ファイル入力直接操作試行...');
      const fileInputSelectors = [
        'input[type="file"]',
        'input[accept*="video"]',
        'input[accept*="image"]',
        'input[name="file"]'
      ];
      
      let uploaded = false;
      for (const selector of fileInputSelectors) {
        const fileInput = await page.$(selector);
        if (fileInput) {
          console.log(`✅ ファイル入力検出: ${selector}`);
          await fileInput.uploadFile(videoPath);
          uploaded = true;
          break;
        }
      }
      
      if (!uploaded) {
        console.error('❌ ファイル入力なし');
        process.exit(1);
      }
    }

    await randomDelay(5000, 8000);
    await takeScreenshot(page, 'after-upload');
    console.log('✅ 動画アップロード完了');

    // エンコード待機
    console.log('\n⏳ エンコード待機...');
    await randomDelay(10000, 15000);
    await takeScreenshot(page, 'after-encoding');

    // Next ボタンクリック（1回目）
    console.log('\n➡️  Step 7: Next（1回目）...');
    const next1Clicked = await hybridClick(
      page,
      'Next',
      'Next button at the bottom right of the dialog',
      [
        'button:has-text("Next")',
        'button:has-text("次へ")',
        '//button[text()="Next"]',
        '//button[text()="次へ"]'
      ]
    );
    
    if (!next1Clicked) {
      console.error('❌ Nextボタン（1回目）が見つかりません');
      process.exit(1);
    }

    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'after-next-1');

    // Next ボタンクリック（2回目）
    console.log('\n➡️  Step 8: Next（2回目）...');
    const next2Clicked = await hybridClick(
      page,
      'Next',
      'Next button at the bottom right of the dialog',
      [
        'button:has-text("Next")',
        'button:has-text("次へ")',
        '//button[text()="Next"]',
        '//button[text()="次へ"]'
      ]
    );
    
    if (!next2Clicked) {
      console.error('❌ Nextボタン（2回目）が見つかりません');
      process.exit(1);
    }

    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'after-next-2');

    // キャプション入力
    console.log('\n📝 Step 9: キャプション入力...');
    const captionSelectors = [
      'textarea[aria-label="Write a caption..."]',
      'textarea[aria-label="キャプションを入力..."]',
      'textarea[placeholder="Write a caption..."]',
      'div[contenteditable="true"][role="textbox"]'
    ];
    
    let captionEntered = false;
    for (const selector of captionSelectors) {
      const captionField = await page.$(selector);
      if (captionField) {
        console.log(`✅ キャプション入力欄検出: ${selector}`);
        await captionField.click();
        await randomDelay(500, 1000);
        await captionField.type(caption, { delay: 50 });
        captionEntered = true;
        break;
      }
    }
    
    if (!captionEntered) {
      console.error('❌ キャプション入力欄なし');
      process.exit(1);
    }

    await randomDelay(2000, 3000);
    await takeScreenshot(page, 'after-caption');
    console.log('✅ キャプション入力完了');

    // Share ボタンクリック
    console.log('\n🚀 Step 10: Share...');
    const shareClicked = await hybridClick(
      page,
      'Share',
      'Share button at the bottom right of the dialog',
      [
        'button:has-text("Share")',
        'button:has-text("シェア")',
        '//button[text()="Share"]',
        '//button[text()="シェア"]'
      ]
    );
    
    if (!shareClicked) {
      console.error('❌ Shareボタンが見つかりません');
      process.exit(1);
    }

    await randomDelay(5000, 8000);
    await takeScreenshot(page, 'final-success');
    
    console.log('\n✅ Instagram投稿完了（Vision APIハイブリッド方式）');

  } catch (error) {
    console.error('\n❌ エラー発生:', error.message);
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await takeScreenshot(pages[0], 'final-error');
      }
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('致命的エラー:', err);
  process.exit(1);
});
