#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COOKIES_DIR = '/root/clawd/cookies';
const COOKIES_FILE = path.join(COOKIES_DIR, 'instagram.json');

// ユーザー入力を受け取る関数
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function loginInstagram() {
  let browser;
  try {
    console.log('🐥 Instagram ログインスクリプト開始...\n');

    // ユーザー認証情報を取得
    const username = await promptUser('📱 Instagramユーザー名を入力: ');
    const password = await promptUser('🔑 パスワードを入力: ');

    console.log('\n⏳ Instagramにアクセス中...\n');

    // ブラウザを起動
    browser = await chromium.launch({ headless: true });
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // ログインページに移動
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('✅ ログインページ読み込み完了\n');

    // ユーザー名入力
    await page.fill('input[name="username"]', username, { timeout: 5000 });
    console.log('✅ ユーザー名を入力');

    // パスワード入力
    await page.fill('input[name="password"]', password, { timeout: 5000 });
    console.log('✅ パスワードを入力\n');

    // ログインボタンをクリック
    await page.click('button[type="button"]', { timeout: 5000 });
    console.log('⏳ ログイン処理中...\n');

    // 2要素認証画面を待機
    try {
      await page.waitForSelector('input[name="verificationCode"]', {
        timeout: 15000,
      });

      console.log('❓ 確認コード（OTP）が必要です。');
      console.log(
        '   Instagramアプリ / SMS / メール で確認コードを確認してください。\n'
      );

      const otp = await promptUser('📨 確認コード（6桁）を入力: ');

      // OTP入力
      await page.fill('input[name="verificationCode"]', otp, { timeout: 5000 });
      console.log('✅ OTPを入力しました\n');

      // 確認ボタンをクリック
      await page.click('button[type="button"]', { timeout: 5000 });
      console.log('⏳ 確認処理中...\n');
    } catch (e) {
      console.log('✅ OTP画面が出現しませんでした（スキップ）\n');
    }

    // ログイン成功を待機
    await page.waitForURL('https://www.instagram.com/', {
      timeout: 30000,
    });

    console.log('✅ ログイン成功！\n');

    // Cookie取得
    const cookies = await context.cookies();

    // ディレクトリ作成
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }

    // Cookie保存
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`💾 Cookie を ${COOKIES_FILE} に保存しました\n`);
    console.log('✨ Instagramのセットアップが完了！\n');

    await context.close();
  } catch (error) {
    console.error(`❌ エラーが発生しました:\n${error.message}\n`);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

loginInstagram();
