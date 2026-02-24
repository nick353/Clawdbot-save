#!/usr/bin/env node

/**
 * Instagram 投稿スクリプト（ドロップダウンメニュー対応版）
 * 
 * 使い方:
 *   DRY_RUN=true node post-to-instagram-dropdown.cjs <画像パス> "キャプション"
 *   node post-to-instagram-dropdown.cjs <画像パス> "キャプション"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function waitFor(page, selector, options = {}) {
  const timeout = options.timeout || 10000;
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return true;
  } catch (error) {
    console.error(`⚠️ タイムアウト: ${selector}`);
    return false;
  }
}

async function main() {
  const [, , imagePath, caption] = process.argv;

  if (!imagePath || !caption) {
    console.error('使い方: node post-to-instagram-dropdown.cjs <画像パス> "キャプション"');
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

  console.log('🌐 Instagram 投稿スクリプト（ドロップダウン対応版）');
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

    // Createボタンをクリック
    console.log('🔍 Create ボタンを探索...');
    const createButton = await page.$('svg[aria-label="New post"]');
    if (!createButton) {
      // 代替セレクタ: XPath で "Create" テキストを含むリンクを探す
      const altCreateButton = await page.$x('//a[@role="link"]//span[contains(text(), "Create")]');
      if (altCreateButton.length > 0) {
        await altCreateButton[0].click();
        console.log('✅ Create ボタンをクリック（XPath）');
      } else {
        console.error('❌ Create ボタンが見つかりません');
        await page.screenshot({ path: '/tmp/instagram-create-not-found.png' });
        process.exit(1);
      }
    } else {
      await createButton.click();
      console.log('✅ Create ボタンをクリック（SVGアイコン）');
    }

    await page.waitForTimeout(2000);

    // ドロップダウンメニューから "Post" を選択
    console.log('🔍 ドロップダウンメニューから "Post" を選択...');
    const postMenuItem = await page.$x('//span[contains(text(), "Post")]');
    if (postMenuItem.length === 0) {
      console.error('❌ "Post" メニュー項目が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-post-menu-not-found.png' });
      process.exit(1);
    }

    await postMenuItem[0].click();
    console.log('✅ "Post" メニュー項目をクリック');

    await page.waitForTimeout(2000);

    // ファイルインプットを探す
    console.log('🔍 ファイルインプットを探索...');
    const fileInput = await page.$('input[type="file"][accept="image/jpeg,image/png,image/heic,image/heif,video/mp4,video/quicktime"]');
    if (!fileInput) {
      console.error('❌ ファイルインプットが見つかりません');
      await page.screenshot({ path: '/tmp/instagram-file-input-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);

    // "Next"ボタンをクリック（複数回）
    for (let i = 0; i < 3; i++) {
      console.log(`🔍 "Next" ボタンを探索（${i + 1}/3）...`);
      const nextButton = await page.$x('//button[contains(text(), "Next")]');
      if (nextButton.length > 0) {
        await nextButton[0].click();
        console.log('✅ "Next" ボタンをクリック');
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️ "Next" ボタンが見つかりません（スキップ）');
        break;
      }
    }

    // キャプション入力
    console.log('📝 キャプションを入力...');
    const captionTextarea = await page.$('textarea[aria-label="Write a caption..."]');
    if (!captionTextarea) {
      console.error('❌ キャプション入力欄が見つかりません');
      await page.screenshot({ path: '/tmp/instagram-caption-not-found.png' });
      process.exit(1);
    }

    await captionTextarea.type(caption, { delay: 50 });
    console.log('✅ キャプションを入力');

    await page.waitForTimeout(1000);

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      await page.screenshot({ path: '/tmp/instagram-dry-run.png' });
      console.log('📸 スクリーンショット: /tmp/instagram-dry-run.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Share"ボタンをクリック
    console.log('⏳ 投稿準備完了、投稿しています...');
    const shareButton = await page.$x('//button[contains(text(), "Share")]');
    if (shareButton.length === 0) {
      console.error('❌ "Share" ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/instagram-share-not-found.png' });
      process.exit(1);
    }

    await shareButton[0].click();
    console.log('✅ "Share" ボタンをクリック');

    // 投稿完了を待機
    await page.waitForTimeout(5000);

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
