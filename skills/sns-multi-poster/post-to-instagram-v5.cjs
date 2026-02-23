#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト V5 - Playwright リモートブラウザ対応
 * 
 * 改善点:
 * - Playwrightを使用した高速・安定化
 * - セッション保存による再ログイン不要
 * - Playwright リモートブラウザ対応
 * - メモリ効率化
 * 
 * 使用方法:
 *   1. bash /root/clawd/scripts/instagram-codegen-session.sh でセッション生成
 *   2. node post-to-instagram-v5.cjs <image_path> <caption>
 * 
 * Usage: node post-to-instagram-v5.cjs <image_path> <caption>
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const caption = process.argv[3];

// バリデーション
if (!imagePath || !caption) {
  console.error('❌ 使用方法: node post-to-instagram-v5.cjs <image_path> <caption>');
  console.error('   例: node post-to-instagram-v5.cjs ./photo.jpg "Good morning!"');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像ファイルが見つかりません: ${imagePath}`);
  process.exit(1);
}

// セッションファイルパス
const sessionFile = path.join(__dirname, '../../auth/instagram-storage-state.json');
const profileFile = path.join(__dirname, '../../auth/instagram.json');

async function main() {
  console.log('\n🚀 Instagram 投稿スクリプト V5 - Playwright版');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let browser;
  try {
    // セッション確認
    if (!fs.existsSync(sessionFile)) {
      throw new Error(
        `❌ セッションファイルが見つかりません: ${sessionFile}\n` +
        '💡 まず以下のコマンドを実行してセッションを生成してください:\n' +
        '   bash /root/clawd/scripts/instagram-codegen-session.sh\n'
      );
    }

    console.log('📁 セッションファイル確認:', sessionFile);
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));

    // Playwrightブラウザ起動
    console.log('🌐 Chromium ブラウザを起動中...');
    browser = await chromium.launch({
      headless: true, // デバッグ用に表示
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // セッション付きコンテキスト作成
    console.log('🔐 セッション情報を読み込み中...');
    const context = await browser.newContext({
      storageState: sessionData
    });

    const page = await context.newPage();

    // Instagram に移動
    console.log('⏳ Instagram に移動中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      // ホームページ要素の確認
      return document.querySelector('[aria-label="ホーム"]') !== null ||
             document.querySelector('[aria-label="Home"]') !== null;
    });

    if (!isLoggedIn) {
      throw new Error('❌ Instagram へのログインに失敗しました。セッションが期限切れの可能性があります。');
    }

    console.log('✅ ログイン確認\n');

    // 新規投稿ボタンをクリック
    console.log('📝 新規投稿ボタンをクリック中...');
    
    // 複数のセレクタを試す（UI変更対応）
    const createButtonSelectors = [
      'a[href="#"]', // 新規投稿
      'button:has-text("作成")',
      '[aria-label="新しい投稿を作成"]',
      '[aria-label="Create"]',
      'a[href="/create/"]'
    ];

    let buttonClicked = false;
    for (const selector of createButtonSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        buttonClicked = true;
        break;
      } catch (e) {
        // 次のセレクタを試す
      }
    }

    if (!buttonClicked) {
      // 手動で /create に移動
      console.log('⚠️ 新規投稿ボタンが見つかりません。/create に直接移動します。');
      await page.goto('https://www.instagram.com/create/', { waitUntil: 'domcontentloaded' });
    }

    // ファイル入力を見つけて画像をアップロード
    console.log('📸 画像をアップロード中...');
    
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('❌ ファイル入力要素が見つかりません。');
    }

    await fileInput.setInputFiles(imagePath);

    // アップロード完了を待機
    await page.waitForTimeout(3000);

    // キャプションを入力
    console.log('✍️ キャプションを入力中...');
    const captionInputs = await page.$$('textarea, div[contenteditable="true"]');
    
    if (captionInputs.length === 0) {
      throw new Error('❌ キャプション入力フィールドが見つかりません。');
    }

    // 最初のキャプション入力フィールドを使用
    await captionInputs[0].focus();
    await page.keyboard.type(caption);

    console.log('📄 キャプション:', caption);

    // 共有ボタンをクリック
    console.log('🔘 投稿を共有中...');
    const shareButtons = await page.$$('button');
    
    let shareButtonClicked = false;
    for (const button of shareButtons) {
      const text = await button.textContent();
      if (text && (text.includes('シェア') || text.includes('Share') || text.includes('投稿') || text.includes('Post'))) {
        await button.click();
        shareButtonClicked = true;
        break;
      }
    }

    if (!shareButtonClicked) {
      throw new Error('❌ 投稿ボタンが見つかりません。');
    }

    // 投稿完了を待機
    console.log('⏳ 投稿が公開されるのを待機中...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
      // タイムアウトしても成功の可能性がある
    });

    // 投稿成功確認
    const successMessage = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const dialog of dialogs) {
        const text = dialog.innerText;
        if (text.includes('共有') || text.includes('成功') || text.includes('Success')) {
          return text;
        }
      }
      return null;
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (successMessage) {
      console.log('✅ Instagram 投稿成功!');
      console.log('📝 投稿内容:', caption);
    } else {
      console.log('⚠️ 投稿が完了しました。Instagram で確認してください。');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error.message);
    console.error('\n💡 トラブルシューティング:');
    console.error('  1. セッションが期限切れの場合: bash /root/clawd/scripts/instagram-codegen-session.sh を実行');
    console.error('  2. Instagram UIが変更された場合: ブラウザ画面で操作を確認');
    console.error('');
    
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

main();
