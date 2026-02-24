#!/usr/bin/env node

/**
 * Pinterest 投稿スクリプト（最終版）
 * 
 * 使い方:
 *   DRY_RUN=true node post-to-pinterest-final.cjs <画像パス> "タイトル" "説明"
 *   node post-to-pinterest-final.cjs <画像パス> "タイトル" "説明"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const [, , imagePath, title, description] = process.argv;

  if (!imagePath || !title) {
    console.error('使い方: node post-to-pinterest-final.cjs <画像パス> "タイトル" "説明"');
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

  console.log('🌐 Pinterest 投稿スクリプト（最終版）');
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

    // ファイルインプットを探す
    console.log('🔍 ファイルインプットを探索...');
    const fileInput = await page.$('input[type="file"][accept="image/png, image/jpeg, image/gif, image/svg+xml, video/mp4, video/quicktime, video/x-m4v"]');
    if (!fileInput) {
      console.error('❌ ファイルインプットが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-file-input-not-found.png' });
      process.exit(1);
    }

    // ファイルをアップロード
    console.log('📸 画像をアップロード...');
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log('✅ 画像をアップロード');

    await page.waitForTimeout(3000);

    // タイトル入力
    console.log('📝 タイトルを入力...');
    const titleInput = await page.$('input[placeholder="Add your title"]');
    if (!titleInput) {
      console.error('❌ タイトル入力欄が見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-title-not-found.png' });
      process.exit(1);
    }

    await titleInput.type(title, { delay: 50 });
    console.log('✅ タイトルを入力');

    await page.waitForTimeout(1000);

    // 説明入力（オプション）
    if (description) {
      console.log('📝 説明を入力...');
      const descInput = await page.$('textarea[placeholder="Tell everyone what your Pin is about"]');
      if (descInput) {
        await descInput.type(description, { delay: 50 });
        console.log('✅ 説明を入力');
      } else {
        console.log('⚠️ 説明入力欄が見つかりません（スキップ）');
      }

      await page.waitForTimeout(1000);
    }

    if (DRY_RUN) {
      console.log('🔄 DRY_RUN モード: 投稿をスキップ');
      await page.screenshot({ path: '/tmp/pinterest-dry-run.png' });
      console.log('📸 スクリーンショット: /tmp/pinterest-dry-run.png');
      console.log('==================================================');
      console.log('✅ DRY_RUN 完了');
      return;
    }

    // "Publish" ボタンをクリック
    console.log('⏳ 投稿準備完了、投稿しています...');
    const publishButton = await page.$('button[data-test-id="board-dropdown-save-button"]');
    if (!publishButton) {
      console.error('❌ "Publish" ボタンが見つかりません');
      await page.screenshot({ path: '/tmp/pinterest-publish-not-found.png' });
      process.exit(1);
    }

    await publishButton.click();
    console.log('✅ "Publish" ボタンをクリック');

    // 投稿完了を待機
    await page.waitForTimeout(5000);

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
