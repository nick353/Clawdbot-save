#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const SCREENSHOT_DIR = '/tmp/instagram-intelligent';
const DRY_RUN = process.env.DRY_RUN === 'true';

// Claudeに画像を見せて質問する関数
async function askClaude(question, imagePath) {
  try {
    // Clawdbot image toolを使用してClaudeに質問
    const result = execSync(`clawdbot image "${imagePath}" "${question}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 
    });
    return result.trim();
  } catch (error) {
    console.error('❌ Claude判断エラー:', error.message);
    throw error;
  }
}

// スクリーンショット保存
async function takeScreenshot(page, step) {
  const filename = `${SCREENSHOT_DIR}/step-${step}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`📸 スクリーンショット保存: ${filename}`);
  return filename;
}

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

// メイン処理
async function postToInstagram(imagePath, caption) {
  console.log('🚀 Instagram投稿開始（Claude駆動）');
  console.log(`📁 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption}`);
  console.log(`🔄 DRY_RUN: ${DRY_RUN}`);
  console.log('');

  // スクリーンショット用ディレクトリ作成
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Cookie読み込み
  console.log('🍪 Cookie読み込み中...');
  const cookies = loadCookies();
  console.log(`✅ Cookie読み込み完了（${cookies.length}個）`);

  // ブラウザ起動
  console.log('🌐 ブラウザ起動中...');
  const browser = await puppeteer.launch({
    headless: true,  // VPS環境用
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
    // Step 1: Instagram投稿ページに遷移
    console.log('📄 Instagram投稿ページに遷移中...');
    await page.goto('https://www.instagram.com/create/style', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const screenshot1 = await takeScreenshot(page, '1-initial');
    console.log('✅ Instagram投稿ページ表示');

    // Step 2: ファイル入力を探す（Claudeに判断を依頼）
    console.log('');
    console.log('🤖 Claudeにファイル入力セレクタを質問中...');
    const fileInputQuery = `このInstagram投稿ページのスクリーンショットを見てください。
ファイル入力（<input type="file">）のCSSセレクタを1つだけ答えてください。
セレクタのみを返してください（説明不要）。

例: input[type="file"]
例: input[accept*="image"]
例: input[data-testid="file-input"]`;

    const fileInputSelector = await askClaude(fileInputQuery, screenshot1);
    console.log(`✅ Claude判断: ${fileInputSelector}`);

    if (DRY_RUN) {
      console.log('🔄 DRY RUN: ファイルアップロードをスキップ');
    } else {
      // ファイルアップロード
      console.log('📤 ファイルアップロード中...');
      const fileInput = await page.$(fileInputSelector);
      if (!fileInput) {
        throw new Error(`ファイル入力が見つかりません: ${fileInputSelector}`);
      }
      await fileInput.uploadFile(imagePath);
      console.log('✅ ファイルアップロード完了');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Step 3: キャプション入力欄を探す
    const screenshot2 = await takeScreenshot(page, '2-after-upload');
    console.log('');
    console.log('🤖 Claudeにキャプション入力欄セレクタを質問中...');
    const captionQuery = `このスクリーンショットを見てください。
キャプション入力欄（textarea または contenteditable div）のCSSセレクタを1つだけ答えてください。
セレクタのみを返してください（説明不要）。

例: textarea[aria-label*="caption"]
例: div[contenteditable="true"]
例: textarea.caption-input`;

    const captionSelector = await askClaude(captionQuery, screenshot2);
    console.log(`✅ Claude判断: ${captionSelector}`);

    if (DRY_RUN) {
      console.log('🔄 DRY RUN: キャプション入力をスキップ');
    } else {
      // キャプション入力
      console.log('📝 キャプション入力中...');
      await page.waitForSelector(captionSelector, { timeout: 10000 });
      await page.click(captionSelector);
      await page.type(captionSelector, caption, { delay: 50 });
      console.log('✅ キャプション入力完了');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 4: 投稿ボタンを探す
    const screenshot3 = await takeScreenshot(page, '3-after-caption');
    console.log('');
    console.log('🤖 Claudeに投稿ボタンセレクタを質問中...');
    const submitQuery = `このスクリーンショットを見てください。
投稿を完了するボタン（"Share" または "投稿" ボタン）のCSSセレクタを1つだけ答えてください。
セレクタのみを返してください（説明不要）。

例: button:has-text("Share")
例: button[type="submit"]
例: button:contains("投稿")

注意: Puppeteerで使える標準CSSセレクタで答えてください。`;

    const submitSelector = await askClaude(submitQuery, screenshot3);
    console.log(`✅ Claude判断: ${submitSelector}`);

    if (DRY_RUN) {
      console.log('🔄 DRY RUN: 投稿をスキップ');
    } else {
      // 投稿実行
      console.log('🚀 投稿実行中...');
      await page.waitForSelector(submitSelector, { timeout: 10000 });
      await page.click(submitSelector);
      console.log('✅ 投稿ボタンクリック完了');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const screenshot4 = await takeScreenshot(page, '4-after-submit');
      console.log('📸 投稿後のスクリーンショット保存');
    }

    console.log('');
    console.log('✅ Instagram投稿完了！');
    console.log(`📂 スクリーンショット: ${SCREENSHOT_DIR}/`);

  } catch (error) {
    console.error('❌ エラー発生:', error.message);
    const errorScreenshot = await takeScreenshot(page, 'error');
    console.error(`📸 エラー時スクリーンショット: ${errorScreenshot}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// CLI引数パース
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ 使い方: node post-instagram-intelligent.mjs <画像パス> "キャプション"');
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
