#!/usr/bin/env node

/**
 * Instagram 投稿スクリプト（スマート版）
 * 
 * 柔軟なセレクタで複数パターンを試す
 * 使い方:
 *   DRY_RUN=true node post-to-instagram-smart.cjs <画像パス> "キャプション"
 *   node post-to-instagram-smart.cjs <画像パス> "キャプション"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
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
      // 次のパターンを試す
      continue;
    }
  }
  
  console.error(`❌ ${description}が見つかりません`);
  await page.screenshot({ path: `/tmp/instagram-${description.replace(/\s+/g, '-')}-not-found.png` });
  return false;
}

async function main() {
  const [, , imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('使い方: node post-to-instagram-smart.cjs <画像パス> "キャプション"');
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

  console.log('🌐 Instagram 投稿スクリプト（スマート版）');
  console.log('==================================================');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Cookie読み込み
    console.log('✅ Cookie読み込み');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);

    // Instagram ホームに移動
    console.log('🌐 Instagram にアクセス...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(3000);
    console.log('✅ ページ読み込み完了');
    await page.screenshot({ path: '/tmp/ig-smart-1-loaded.png' });

    // Createボタンをクリック（複数パターン）
    const createPatterns = [
      { type: 'css', selector: 'svg[aria-label="New post"]', name: 'SVGアイコン' },
      { type: 'xpath', selector: '//svg[@aria-label="New post"]', name: 'XPath SVG' },
      { type: 'xpath', selector: '//*[contains(text(), "Create")]', name: 'テキスト Create' },
      { type: 'xpath', selector: '//*[@role="link" or @role="button"][.//text()[contains(., "Create")]]', name: 'ロール+テキスト' },
    ];

    if (!await findAndClick(page, createPatterns, 'Create ボタン')) {
      process.exit(1);
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/ig-smart-2-after-create.png' });

    // "Post" メニュー項目をクリック（複数パターン）
    const postMenuPatterns = [
      { type: 'xpath', selector: '//*[contains(text(), "Post") and not(contains(text(), "Reels")) and not(contains(text(), "Story"))]', name: 'テキスト Post' },
      { type: 'xpath', selector: '//div[@role="menuitem"]//span[contains(text(), "Post")]', name: 'メニューアイテム' },
      { type: 'xpath', selector: '//*[@role="button" or @role="menuitem"][.//text()[contains(., "Post")]]', name: 'ロール+テキスト' },
    ];

    if (!await findAndClick(page, postMenuPatterns, 'Post メニュー')) {
      process.exit(1);
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/ig-smart-3-after-post-menu.png' });

    // ファイルインプットを探す（複数パターン）
    console.log('🔍 ファイルインプットを探索...');
    const fileInputPatterns = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="jpeg"]',
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
      await page.screenshot({ path: '/tmp/ig-smart-file-input-not-found.png' });
      
      // デバッグ: ページのHTMLを一部表示
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      fs.writeFileSync('/tmp/ig-smart-body.html', bodyHTML);
      console.log('📄 HTML保存: /tmp/ig-smart-body.html');
      
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/ig-smart-4-after-upload.png' });

    // "Next"ボタンをクリック（複数回）
    for (let i = 0; i < 3; i++) {
      console.log(`🔍 "Next" ボタンを探索（${i + 1}/3）...`);
      const nextPatterns = [
        { type: 'xpath', selector: '//button[contains(text(), "Next")]', name: 'button要素' },
        { type: 'xpath', selector: '//*[@role="button"][contains(text(), "Next")]', name: 'role=button' },
        { type: 'xpath', selector: '//*[contains(text(), "Next")]', name: 'テキスト' },
      ];

      let found = false;
      for (const pattern of nextPatterns) {
        try {
          const elements = await page.$x(pattern.selector);
          if (elements.length > 0) {
            await elements[0].click();
            console.log(`✅ "Next" ボタンをクリック（${pattern.name}）`);
            await page.waitForTimeout(2000);
            found = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!found) {
        console.log('⚠️ "Next" ボタンが見つかりません（スキップ）');
        break;
      }
    }

    await page.screenshot({ path: '/tmp/ig-smart-5-after-next.png' });

    // キャプション入力
    console.log('📝 キャプションを入力...');
    const captionPatterns = [
      'textarea[aria-label*="caption"]',
      'textarea[placeholder*="caption"]',
      'div[contenteditable="true"][aria-label*="caption"]',
      'textarea',
    ];

    let captionField = null;
    for (const selector of captionPatterns) {
      captionField = await page.$(selector);
      if (captionField) {
        console.log(`✅ キャプション入力欄を発見（${selector}）`);
        break;
      }
    }

    if (!captionField) {
      console.error('❌ キャプション入力欄が見つかりません');
      await page.screenshot({ path: '/tmp/ig-smart-caption-not-found.png' });
      process.exit(1);
    }

    await captionField.type(caption, { delay: 50 });
    console.log('✅ キャプションを入力');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/ig-smart-6-after-caption.png' });

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      console.log('📸 スクリーンショット: /tmp/ig-smart-*.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Share"ボタンをクリック
    console.log('⏳ 投稿準備完了、投稿しています...');
    const sharePatterns = [
      { type: 'xpath', selector: '//button[contains(text(), "Share")]', name: 'button要素' },
      { type: 'xpath', selector: '//*[@role="button"][contains(text(), "Share")]', name: 'role=button' },
      { type: 'xpath', selector: '//*[contains(text(), "Share")]', name: 'テキスト' },
    ];

    if (!await findAndClick(page, sharePatterns, 'Share ボタン')) {
      process.exit(1);
    }

    // 投稿完了を待機
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/ig-smart-7-final.png' });

    console.log('==================================================');
    console.log('✅ Instagram 投稿完了');

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
