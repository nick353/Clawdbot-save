#!/usr/bin/env node

/**
 * Pinterest 投稿スクリプト（スマート版）
 * 
 * 柔軟なセレクタで複数パターンを試す
 * 使い方:
 *   DRY_RUN=true node post-to-pinterest-smart.cjs <画像パス> "タイトル" "説明"
 *   node post-to-pinterest-smart.cjs <画像パス> "タイトル" "説明"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function findAndClick(page, patterns, description) {
  console.log(`🔍 ${description}を探索...`);
  
  for (const pattern of patterns) {
    try {
      let element;
      
      if (pattern.type === 'xpath') {
        const elements = await page.$x(pattern.selector);
        if (elements.length > 0) {
          element = elements[0];
        }
      } else {
        element = await page.$(pattern.selector);
      }
      
      if (element) {
        console.log(`✅ ${description}を発見（${pattern.name}）`);
        await element.click();
        console.log(`✅ ${description}をクリック`);
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  console.error(`❌ ${description}が見つかりません`);
  await page.screenshot({ path: `/tmp/pinterest-${description.replace(/\s+/g, '-')}-not-found.png` });
  return false;
}

async function main() {
  const [, , imagePath, title, description] = process.argv;

  if (!imagePath || !title) {
    console.error('使い方: node post-to-pinterest-smart.cjs <画像パス> "タイトル" "説明"');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 画像が見つかりません: ${imagePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(COOKIES_PATH)) {
    console.error(`❌ Cookieファイルが見つかりません: ${COOKIES_PATH}`);
    process.exit(1);
  }

  console.log('🌐 Pinterest 投稿スクリプト（スマート版）');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Cookie読み込み
    console.log('✅ Cookie読み込み');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);

    // Pinterest Pin作成ページに直接移動
    console.log('🌐 Pinterest Pin作成ページにアクセス...');
    await page.goto('https://www.pinterest.com/pin-creation-tool/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(3000);
    console.log('✅ ページ読み込み完了');
    await page.screenshot({ path: '/tmp/pinterest-smart-1-loaded.png' });

    // ファイルインプットを探す
    console.log('🔍 ファイルインプットを探索...');
    const fileInputPatterns = [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="video"]',
      'input[type="file"]',
    ];

    let fileInput = null;
    for (const selector of fileInputPatterns) {
      fileInput = await page.$(selector);
      if (fileInput) {
        console.log(`✅ ファイルインプットを発見（${selector}）`);
        break;
      }
    }

    if (!fileInput) {
      console.error('❌ ファイルインプットが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-smart-file-input-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/pinterest-smart-2-after-upload.png' });

    // タイトル入力
    console.log('📝 タイトルを入力...');
    const titlePatterns = [
      'input[placeholder*="title"]',
      'input[placeholder*="Title"]',
      'input[aria-label*="title"]',
      'input[type="text"]',
    ];

    let titleInput = null;
    for (const selector of titlePatterns) {
      titleInput = await page.$(selector);
      if (titleInput) {
        console.log(`✅ タイトル入力欄を発見（${selector}）`);
        break;
      }
    }

    if (!titleInput) {
      console.error('❌ タイトル入力欄が見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-smart-title-not-found.png' });
      process.exit(1);
    }

    await titleInput.type(title, { delay: 50 });
    console.log('✅ タイトルを入力');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/pinterest-smart-3-after-title.png' });

    // 説明入力（オプション）
    if (description) {
      console.log('📝 説明を入力...');
      const descPatterns = [
        'textarea[placeholder*="Tell"]',
        'textarea[placeholder*="everyone"]',
        'textarea[aria-label*="description"]',
        'textarea',
      ];

      let descInput = null;
      for (const selector of descPatterns) {
        descInput = await page.$(selector);
        if (descInput) {
          console.log(`✅ 説明入力欄を発見（${selector}）`);
          break;
        }
      }

      if (descInput) {
        await descInput.type(description, { delay: 50 });
        console.log('✅ 説明を入力');
      } else {
        console.log('⚠️ 説明入力欄が見つかりません（スキップ）');
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/pinterest-smart-4-after-desc.png' });
    }

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      console.log('📸 スクリーンショット: /tmp/pinterest-smart-*.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Publish" / "Save" ボタンをクリック
    const publishPatterns = [
      { type: 'css', selector: 'button[data-test-id="board-dropdown-save-button"]', name: 'data-test-id' },
      { type: 'xpath', selector: '//button[contains(text(), "Publish")]', name: 'テキスト Publish' },
      { type: 'xpath', selector: '//button[contains(text(), "Save")]', name: 'テキスト Save' },
      { type: 'xpath', selector: '//*[@role="button"][contains(text(), "Publish") or contains(text(), "Save")]', name: 'role=button' },
    ];

    if (!await findAndClick(page, publishPatterns, 'Publish ボタン')) {
      process.exit(1);
    }

    // 投稿完了を待機
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/pinterest-smart-5-final.png' });

    console.log('==================================================');
    console.log('✅ Pinterest 投稿完了');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
