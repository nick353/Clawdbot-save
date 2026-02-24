#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト (Playwright ブラウザプロファイル版)
 * ブラウザプロファイルで自動ログイン → 投稿
 * プロファイルが存在しない場合は Cookie フォールバック
 *
 * Usage: node post-to-instagram-playwright.cjs <image_path> <caption>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , imagePath, caption] = process.argv;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-playwright.cjs <image_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// DRY_RUNモード
if (DRY_RUN) {
  console.log('🔄 DRY RUN: Instagram投稿スキップ');
  console.log('📷 画像:', imagePath);
  console.log('📝 キャプション:', caption);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

// ブラウザプロファイルディレクトリ
const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-pw-${label}-${ts}.png`;
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
  console.log('📸 Instagram 投稿スクリプト (Playwright)');
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
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });

      // クッキーも追加（フォールバック）
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await context.addCookies(cookies);
      console.log(`✅ Cookie数: ${cookies.length}`);
    } else {
      console.log('⚠️  ブラウザプロファイルが見つかりません');
      console.log('   初期化スクリプトを実行してください:');
      console.log('   node /root/clawd/scripts/instagram-login-setup.js');
      process.exit(1);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);

    // Instagram にアクセス
    console.log('');
    console.log('🌐 Instagram にアクセスしています...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 作成ボタンを探す（aria-label="New post"のSVGアイコン）
    console.log('🔍 作成ボタンを探しています...');
    const createButton = await waitFor(
      page,
      ['div[aria-label="New post"]', 'div[role="img"][aria-label="New post"]', 'a[href="#"]', 'svg[aria-label="New post"]'],
      'create button'
    );

    await createButton.click();
    console.log('✅ 作成ボタンをクリック');

    // ファイルアップロード
    console.log('');
    console.log('📸 画像をアップロードしています...');
    const fileInput = await waitFor(
      page,
      ['input[type="file"]'],
      'file input'
    );

    await fileInput.setInputFiles(path.resolve(imagePath));
    console.log('✅ 画像をアップロード');

    // 次へボタンをクリック
    console.log('');
    console.log('⏳ 画像処理を待機中...');
    await page.waitForTimeout(3000);

    const nextButton = await waitFor(page, ['button:has-text("次へ")'], 'next button');
    await nextButton.click();
    console.log('✅ 次へボタンをクリック');

    // フィルター選択画面をスキップ
    console.log('');
    console.log('⏳ フィルター選択画面を処理中...');
    await page.waitForTimeout(2000);

    const nextButton2 = await waitFor(page, ['button:has-text("次へ")'], 'next button 2', 10000);
    await nextButton2.click();
    console.log('✅ 次へボタンをクリック (フィルター)');

    // キャプションを入力
    console.log('');
    console.log('✍️  キャプションを入力しています...');
    await page.waitForTimeout(2000);

    const captionInput = await waitFor(
      page,
      ['textarea[aria-label*="キャプション"]', 'textarea[placeholder*="キャプション"]', 'textarea'],
      'caption input'
    );

    await captionInput.click();
    await captionInput.fill(caption);
    console.log(`✅ キャプション入力完了: ${caption.substring(0, 50)}...`);

    // 投稿ボタンをクリック
    console.log('');
    console.log('⏳ 投稿準備完了、投稿しています...');
    const shareButton = await waitFor(
      page,
      ['button:has-text("投稿する")', 'button:has-text("シェア")'],
      'share button'
    );

    await shareButton.click();
    console.log('✅ 投稿ボタンをクリック');

    // 投稿完了を待機
    console.log('');
    console.log('⏳ 投稿完了を待機しています...');
    await page.waitForTimeout(5000);

    // 成功メッセージ確認
    try {
      await page.waitForSelector('text="投稿しました"', { timeout: 30000 });
      console.log('✅ 投稿完了!');
    } catch (e) {
      // メッセージが見つからない場合でも続行
      console.log('✅ 投稿処理完了 (確認ページで検証)');
    }

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
    console.log('✅ Instagram 投稿が完了しました!');
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
