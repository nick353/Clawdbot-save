#!/usr/bin/env node
/**
 * Facebook 投稿スクリプト (Playwright ブラウザプロファイル版)
 * ブラウザプロファイルで自動ログイン → テキスト/画像投稿
 *
 * Usage: node post-to-facebook-playwright.cjs <text> [image_path]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , text, imagePath] = process.argv;

if (!text) {
  console.error('使い方: node post-to-facebook-playwright.cjs <text> [image_path]');
  process.exit(1);
}

if (imagePath && !fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// ブラウザプロファイルディレクトリ
const PROFILE_DIR = '/root/clawd/browser-profiles/facebook';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/facebook.json';

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/fb-pw-${label}-${ts}.png`;
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function waitFor(page, selectors, desc, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const vis = await page.evaluate((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }, el);
          if (vis) return el;
        }
      } catch (e) {
        // セレクタが見つからない
      }
    }
    await page.waitForTimeout(500);
  }

  // エラー時の自動デバッグ
  console.error(`⚠️  "${desc}" が見つかりませんでした。デバッグ情報を保存します...`);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const debugDir = '/tmp';

  try {
    // スクリーンショット保存
    const screenshotPath = path.join(debugDir, `fb-error-${desc.replace(/\s/g, '-')}-${ts}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`📸 スクリーンショット: ${screenshotPath}`);

    // HTML解析
    const html = await page.content();
    const htmlPath = path.join(debugDir, `fb-error-${desc.replace(/\s/g, '-')}-${ts}.html`);
    fs.writeFileSync(htmlPath, html);
    console.error(`📄 HTML: ${htmlPath}`);

    // セレクタ解析
    console.error(`🔍 試したセレクタ: ${selectors.join(', ')}`);

  } catch (debugErr) {
    console.error(`⚠️  デバッグ情報の保存に失敗: ${debugErr.message}`);
  }

  throw new Error(`Timeout waiting for ${desc}`);
}

async function main() {
  console.log('👥 Facebook 投稿スクリプト (Playwright)');
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    let context;

    // ブラウザプロファイルが存在するか確認
    if (fs.existsSync(COOKIES_PATH)) {
      console.log('📂 Cookie認証を使用します');

      // StorageStateがある場合はそれを使用、ない場合は新規作成
      const contextOptions = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      };

      if (fs.existsSync(STATE_PATH)) {
        contextOptions.storageState = STATE_PATH;
        console.log('✅ StorageStateを読み込み');
      }

      context = await browser.newContext(contextOptions);

      // クッキーを追加
      const cookieData = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      const cookies = cookieData.cookies || cookieData; // storageState形式または配列形式に対応
      await context.addCookies(cookies);
      console.log(`✅ Cookie数: ${cookies.length}`);
    } else {
      console.log('⚠️  Cookieファイルが見つかりません: ' + COOKIES_PATH);
      console.log('   Cookieを取得してください');
      process.exit(1);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);

    // Facebook にアクセス
    console.log('');
    console.log('🌐 Facebook にアクセスしています...');
    await page.goto('https://www.facebook.com/feed', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 投稿作成ボタンを探す（"What's on your mind"）
    console.log('🔍 投稿作成ボタンを探しています...');
    const createPostButton = await waitFor(
      page,
      ['div[role="button"]:has-text("What\'s on your mind")', 'div[role="button"]:has-text("何か思いついた")', 'span:has-text("What\'s on your mind")'],
      'create post button'
    );

    await createPostButton.click();
    console.log('✅ 投稿作成ボタンをクリック');

    // テキストを入力
    console.log('');
    console.log('✍️  テキストを入力しています...');
    await page.waitForTimeout(2000);

    const textInput = await waitFor(page, ['textarea', 'div[role="textbox"]'], 'text input');

    await textInput.click();
    await textInput.type(text, { delay: 10 });
    console.log(`✅ テキスト入力完了: ${text.substring(0, 50)}...`);

    // 画像がある場合はアップロード
    if (imagePath) {
      console.log('');
      console.log('📸 画像をアップロードしています...');

      // ファイルアップロードボタンを探す
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(imagePath));
        console.log('✅ 画像をアップロード');
        await page.waitForTimeout(3000);
      }
    }

    // 投稿ボタンをクリック（画像がある場合は"Next"、ない場合は"Post"）
    console.log('');
    console.log('⏳ 投稿準備完了、投稿しています...');
    
    // Playwright getByRole を使う（より確実）
    let postButton;
    try {
      postButton = await page.getByRole('button', { name: 'Next' }).first();
      await postButton.waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
      // "Next"が見つからない場合は"Post"を探す
      try {
        postButton = await page.getByRole('button', { name: 'Post' }).first();
        await postButton.waitFor({ state: 'visible', timeout: 5000 });
      } catch (e2) {
        // 日本語の場合
        postButton = await page.getByRole('button', { name: '投稿' }).first();
        await postButton.waitFor({ state: 'visible', timeout: 5000 });
      }
    }

    await postButton.click();
    console.log('✅ 投稿ボタンをクリック');

    // 画像投稿の場合、"Next"の後に"Post"ボタンが表示される
    if (imagePath) {
      console.log('');
      console.log('⏳ 最終投稿ボタンを待機しています...');
      await page.waitForTimeout(2000);

      // "Post"ボタンを探す
      try {
        const finalPostButton = await page.getByRole('button', { name: 'Post' }).first();
        await finalPostButton.waitFor({ state: 'visible', timeout: 10000 });
        await finalPostButton.click();
        console.log('✅ 最終投稿ボタンをクリック');
      } catch (e) {
        // "Post"ボタンが見つからない場合は、日本語を試す
        try {
          const finalPostButton = await page.getByRole('button', { name: '投稿' }).first();
          await finalPostButton.waitFor({ state: 'visible', timeout: 5000 });
          await finalPostButton.click();
          console.log('✅ 最終投稿ボタンをクリック');
        } catch (e2) {
          console.log('⚠️  最終投稿ボタンが見つかりませんでした（すでに投稿済みの可能性）');
        }
      }
    }

    // 投稿完了を待機
    console.log('');
    console.log('⏳ 投稿完了を待機しています...');
    await page.waitForTimeout(3000);

    // プロファイルを保存（セッション更新用）
    console.log('');
    console.log('💾 セッションを保存しています...');
    const newState = await context.storageState();
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(newState, null, 2));

    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('✅ セッション保存完了');

    console.log('');
    console.log('='.repeat(50));
    console.log('✅ Facebook 投稿が完了しました!');
    console.log('='.repeat(50));

    await context.close();
  } catch (error) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);

    // エラー時のデバッグ情報保存
    try {
      const page = context ? (await context.pages())[0] : null;
      if (page) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const debugDir = '/tmp';

        // スクリーンショット
        const screenshotPath = path.join(debugDir, `fb-main-error-${ts}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`📸 エラー時スクリーンショット: ${screenshotPath}`);

        // HTML
        const html = await page.content();
        const htmlPath = path.join(debugDir, `fb-main-error-${ts}.html`);
        fs.writeFileSync(htmlPath, html);
        console.error(`📄 エラー時HTML: ${htmlPath}`);
      }
    } catch (debugErr) {
      console.error(`⚠️  エラー時デバッグ情報の保存に失敗: ${debugErr.message}`);
    }

    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
