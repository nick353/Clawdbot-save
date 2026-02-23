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
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

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
    if (fs.existsSync(STATE_PATH) && fs.existsSync(COOKIES_PATH)) {
      console.log('📂 ブラウザプロファイルを使用します');

      context = await browser.newContext({
        storageState: STATE_PATH,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      });

      // クッキーも追加（フォールバック）
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await context.addCookies(cookies);
      console.log(`✅ Cookie数: ${cookies.length}`);
    } else {
      console.log('⚠️  ブラウザプロファイルが見つかりません');
      console.log('   初期化スクリプトを実行してください:');
      console.log('   node /root/clawd/scripts/facebook-login-setup.js');
      process.exit(1);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);

    // Facebook にアクセス
    console.log('');
    console.log('🌐 Facebook にアクセスしています...');
    await page.goto('https://www.facebook.com/feed', { waitUntil: 'networkidle' });

    // 投稿作成ボタンを探す
    console.log('🔍 投稿作成ボタンを探しています...');
    const createPostButton = await waitFor(
      page,
      ['div[role="button"]:has-text("何か思いついた")', 'button[aria-label*="投稿"]'],
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

    // 投稿ボタンをクリック
    console.log('');
    console.log('⏳ 投稿準備完了、投稿しています...');
    const postButton = await waitFor(
      page,
      ['button:has-text("投稿")'],
      'post button',
      10000
    );

    await postButton.click();
    console.log('✅ 投稿ボタンをクリック');

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
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
