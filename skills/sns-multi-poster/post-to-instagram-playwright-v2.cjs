#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト (Playwright ブラウザプロファイル版 v2)
 * 動作確認済みのinstagram-playwrightアプローチを採用
 * - getByRole()でアクセシビリティベースのセレクタ
 * - file chooserイベント待機
 * - ランダムタイムアウトでヒューマンライク
 *
 * Usage: node post-to-instagram-playwright-v2.cjs <image_path> <caption>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , imagePath, caption] = process.argv;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-playwright-v2.cjs <image_path> <caption>');
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

// ランダムタイムアウト（Anti-Ban）
function getRandomTimeout() {
  return 1000 + Math.random() * 2000; // 1-3秒
}

async function main() {
  console.log('📸 Instagram 投稿スクリプト (Playwright v2)');
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
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
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

    // ログイン確認（Create post ボタンが表示されているか）
    console.log('');
    console.log('🔍 ログイン状態を確認しています...');
    try {
      await page.getByRole('link', { name: /New post|新規投稿|作成/ }).click({ timeout: 3000 });
      console.log('✅ ログイン成功、Create post をクリック');
    } catch (e) {
      console.error('❌ ログインセッションが無効です。再ログインしてください。');
      await page.screenshot({ path: '/tmp/instagram-login-expired.png', fullPage: true });
      process.exit(1);
    }

    // ランダムタイムアウト
    await page.waitForTimeout(getRandomTimeout());

    // ファイルアップロード（file chooserイベント待機）
    console.log('');
    console.log('📸 画像をアップロードしています...');
    const fileChooserPromise = page.waitForEvent('filechooser');

    try {
      await page.getByRole('button', { name: /Select [Ff]rom [Cc]omputer|コンピューター/ }).click();
    } catch (e) {
      // 日本語UIの場合
      await page.getByRole('button', { name: /コンピューターから選択/ }).click();
    }

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([path.resolve(imagePath)]);
    console.log('✅ 画像をアップロード');

    // ランダムタイムアウト
    await page.waitForTimeout(getRandomTimeout());

    // 次へボタンをクリック（1回目）
    console.log('');
    console.log('⏳ 画像処理を待機中...');
    await page.getByRole('button', { name: /Next|次へ/ }).click();
    console.log('✅ 次へボタンをクリック (1回目)');

    // ランダムタイムアウト
    await page.waitForTimeout(getRandomTimeout());

    // 次へボタンをクリック（2回目 - フィルター選択）
    console.log('');
    console.log('⏳ フィルター選択画面を処理中...');
    await page.getByRole('button', { name: /Next|次へ/ }).click();
    console.log('✅ 次へボタンをクリック (2回目)');

    // ランダムタイムアウト
    await page.waitForTimeout(getRandomTimeout());

    // キャプションを入力
    console.log('');
    console.log('✍️  キャプションを入力しています...');
    await page.getByRole('paragraph').click();
    
    try {
      await page.getByLabel(/Write a caption|キャプションを書く/).type(caption, { delay: 50 });
    } catch (e) {
      // フォールバック：textareaで探す
      const captionInput = await page.locator('textarea[aria-label*="キャプション"]');
      await captionInput.type(caption, { delay: 50 });
    }
    
    console.log(`✅ キャプション入力完了: ${caption.substring(0, 50)}...`);

    // ランダムタイムアウト
    await page.waitForTimeout(getRandomTimeout());

    // 投稿ボタンをクリック
    console.log('');
    console.log('⏳ 投稿準備完了、投稿しています...');
    await page.getByRole('button', { name: /Share|シェア|投稿する/ }).click();
    console.log('✅ 投稿ボタンをクリック');

    // 投稿完了を待機（"Post shared"メッセージ）
    console.log('');
    console.log('⏳ 投稿完了を待機しています...');
    try {
      const successLocator = page.getByText(/Post shared|投稿しました/);
      await successLocator.waitFor({ timeout: 10000 });
      console.log('✅ 投稿完了!');
    } catch (e) {
      console.log('⚠️  成功メッセージが見つかりませんでした');
      console.log('   スクリーンショットを確認してください');
      await page.screenshot({ path: '/tmp/instagram-post-shared-error.png', fullPage: true });
    }

    // 閉じるボタンをクリック
    try {
      await page.getByRole('button', { name: /Close|閉じる/ }).click();
    } catch (e) {
      console.log('⚠️  閉じるボタンが見つかりませんでした（問題なし）');
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
    await page.screenshot({ path: '/tmp/instagram-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
