#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト - Vision API v3（Postメニュー項目検出改善版）
 * 
 * 改善点:
 * - Post メニュー項目の検出精度を向上
 * - Vision APIで正確に座標を取得してクリック
 * - ダイアログ表示確認を追加
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, videoPath, caption] = process.argv;

if (!videoPath || !caption) {
  console.error('使い方: node post-to-instagram-vision-v3.cjs <video_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(videoPath)) {
  console.error(`❌ 動画が見つかりません: ${videoPath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const DEBUG_DIR = '/tmp/instagram-vision-debug';
const INSTAGRAM_URL = 'https://www.instagram.com/';

// Vision API設定
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_VISION = !!GEMINI_API_KEY;

if (!USE_VISION) {
  console.log('⚠️  GEMINI_API_KEY未設定 → セレクタモードのみ');
  process.exit(1);
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
                { text: `あなたはUI要素検出の専門家です。以下の画像から、指定されたUI要素を探して、その中心座標を返してください。

**重要なルール:**
1. **テキストラベル優先**: ボタンやメニュー項目の「テキストラベル」を最優先で探す
2. **バッジ・カウンターは無視**: "Post (98%)" のようなバッジやカウンター表示は対象外
3. **位置情報を活用**: プロンプトに位置情報（例: "in the left sidebar", "below Notifications"）がある場合は、その領域内で探す
4. **正確な座標**: 要素の**クリック可能な領域の中心座標**（ピクセル単位）を返す
5. **メニュー項目**: メニューが展開されている場合、メニュー項目の**テキスト部分**の中心座標を返す

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

async function main() {
  console.log('🎥 Instagram Vision v3投稿開始');
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
    console.log('\n➕ Step 4: Create ボタンクリック...');
    let screenshotPath = await takeScreenshot(page, 'before-create');
    
    const createResult = await detectWithGemini(
      screenshotPath,
      'Create button with plus icon in the left sidebar (the button, not the text label)'
    );
    
    if (createResult && createResult.confidence > 0.6) {
      await page.mouse.click(createResult.x, createResult.y);
      console.log(`✅ Create Vision座標でクリック成功`);
    } else {
      // フォールバック
      const createBtn = await page.$('svg[aria-label="New post"]');
      if (createBtn) {
        await createBtn.click();
        console.log(`✅ Createセレクタでクリック成功`);
      } else {
        console.error('❌ Createボタンが見つかりません');
        process.exit(1);
      }
    }

    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'after-create');

    // Post メニュー項目クリック
    console.log('\n📋 Step 5: Post メニュー項目クリック...');
    screenshotPath = await takeScreenshot(page, 'before-post-menu');
    
    const postResult = await detectWithGemini(
      screenshotPath,
      'The "Post" menu item in the left sidebar, which is the first item in the expanded Create menu (with a small square icon next to it)'
    );
    
    if (!postResult || postResult.confidence < 0.7) {
      console.error('❌ Post メニュー項目が見つかりません');
      process.exit(1);
    }

    console.log(`✅ Post メニュー項目検出: (${postResult.x}, ${postResult.y})`);
    await page.mouse.click(postResult.x, postResult.y);
    console.log(`✅ Post Vision座標でクリック成功`);

    await randomDelay(5000, 8000);
    await takeScreenshot(page, 'after-post-click');

    // アップロードダイアログ確認
    console.log('\n📤 Step 6: アップロードダイアログ確認...');
    screenshotPath = await takeScreenshot(page, 'upload-dialog-check');
    
    const dialogResult = await detectWithGemini(
      screenshotPath,
      'File upload dialog box (centered on screen, with "Select from computer" text or drag-and-drop area)'
    );
    
    if (!dialogResult) {
      console.error('❌ アップロードダイアログが表示されていません');
      process.exit(1);
    }

    console.log(`✅ アップロードダイアログ検出成功`);

    // ファイルアップロード
    console.log('\n📤 Step 7: ファイルアップロード...');
    
    // アプローチ1: "Select from computer" ボタンをVision APIで検出
    const selectBtnResult = await detectWithGemini(
      screenshotPath,
      '"Select from computer" button in the file upload dialog'
    );
    
    if (selectBtnResult && selectBtnResult.confidence > 0.6) {
      console.log(`✅ "Select from computer" ボタン検出: (${selectBtnResult.x}, ${selectBtnResult.y})`);
      
      // FileChooserを待機してからクリック
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 30000 }),
        page.mouse.click(selectBtnResult.x, selectBtnResult.y)
      ]);
      
      await fileChooser.accept([videoPath]);
      console.log('✅ ファイルアップロード成功（Vision APIボタンクリック）');
    } else {
      // アプローチ2: ファイル入力直接操作
      console.log('⚠️  "Select from computer" ボタン未検出 → ファイル入力直接操作');
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(videoPath);
        console.log('✅ ファイルアップロード成功（直接操作）');
      } else {
        console.error('❌ ファイル入力なし');
        process.exit(1);
      }
    }

    await randomDelay(10000, 15000);
    await takeScreenshot(page, 'after-upload');
    console.log('✅ 動画アップロード完了');

    console.log('\n✅ Instagram投稿テスト完了（Vision API v3）');

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
