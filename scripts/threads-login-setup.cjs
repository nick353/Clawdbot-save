#!/usr/bin/env node
/**
 * Threads ブラウザプロファイル初期化スクリプト
 * 初回実行: 手動ログイン → プロファイル保存
 * 以後: プロファイル読み込み
 *
 * Usage: node threads-login-setup.js [--headless]
 */

const { PlaywrightBrowserAuth, chromium } = require('./playwright-browser-auth.cjs');
const readline = require('readline');

const args = process.argv.slice(2);
const headless = args.includes('--headless');

const auth = new PlaywrightBrowserAuth('threads');

// 確認待ちのためのプロンプト
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🧵 Threads ブラウザプロファイル初期化');
  console.log('');

  // プロファイルが既に存在するか確認
  if (auth.profileExists()) {
    const info = auth.getProfileInfo();
    console.log('✅ プロファイルが見つかりました');
    console.log(`   保存日時: ${info.savedAt}`);
    console.log(`   Cookie数: ${info.cookieCount}`);
    console.log('');

    const reauth = await prompt('新しくログインしますか？ (yes/no): ');
    if (reauth.toLowerCase() !== 'yes' && reauth.toLowerCase() !== 'y') {
      console.log('既存プロファイルを使用します');
      process.exit(0);
    }

    console.log('');
    console.log('プロファイルをリセットします...');
    auth.deleteProfile();
  }

  // ブラウザを起動
  console.log('🚀 ブラウザを起動しています...');
  const browser = await chromium.launch(
    headless ? PlaywrightBrowserAuth.getHeadlessOptions() : PlaywrightBrowserAuth.getBrowserLaunchOptions()
  );

  try {
    // コンテキストを作成（新規）
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      geolocation: { latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    });

    const page = await context.newPage();

    // Threads にアクセス
    console.log('🌐 Threads にアクセスしています...');
    await page.goto('https://www.threads.net/', { waitUntil: 'networkidle', timeout: 60000 });

    // ログインが必要な場合、プロンプトを表示
    console.log('');
    console.log('='.repeat(50));
    console.log('📌 ブラウザウィンドウが表示されています');
    console.log('🧵 手動でログインしてください');
    console.log('');
    console.log('✅ ログイン完了したら、このスクリプトに戻って「Enter」を押してください');
    console.log('='.repeat(50));
    console.log('');

    // ユーザー入力を待つ
    if (!headless) {
      await prompt('ログイン完了しましたか？ (Enter キーを押してください): ');
    } else {
      console.log('⚠️  ヘッドレスモードでは自動ログインできません');
      console.log('   --headless オプションを外して実行してください');
      process.exit(1);
    }

    // ページがロードされているか確認
    console.log('');
    console.log('🔍 ページを確認しています...');
    await page.waitForTimeout(2000); // ページの読み込みを待つ

    // プロファイルを保存
    console.log('💾 プロファイルを保存しています...');
    await auth.saveContext(context);

    console.log('');
    console.log('✅ Threads プロファイルの初期化が完了しました');
    console.log(`   保存先: ${auth.profileDir}`);
    console.log('');
    console.log('次回以降は、このプロファイルが自動的に使用されます');

    await context.close();
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
