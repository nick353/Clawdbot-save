#!/usr/bin/env node
/**
 * Instagram手動ログイン + プロファイル保存スクリプト
 * 人間らしい操作シミュレーション + 完全ステルス対応
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/profiles/instagram';
const USERNAME = 'nisen_prints';
const PASSWORD = process.env.IG_PASSWORD;

if (!PASSWORD) {
  console.error('❌ エラー: IG_PASSWORD が設定されていません');
  process.exit(1);
}

// 人間らしい遅延
const randomDelay = (min, max) => new Promise(resolve => 
  setTimeout(resolve, Math.random() * (max - min) + min)
);

// マウス移動シミュレーション
const humanMouseMoveToElement = async (page, selector) => {
  const element = await page.$(selector);
  if (!element) return;
  const box = await element.boundingBox();
  if (!box) return;
  
  const startX = Math.random() * 500;
  const startY = Math.random() * 300;
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  
  await page.mouse.move(startX, startY);
  await randomDelay(100, 300);
  
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const x = startX + (targetX - startX) * (i / steps);
    const y = startY + (targetY - startY) * (i / steps);
    await page.mouse.move(x, y);
    await randomDelay(10, 30);
  }
};

// 1文字ずつの人間らしい入力
const humanTypeText = async (page, selector, text) => {
  await page.click(selector);
  await randomDelay(200, 400);
  
  for (const char of text) {
    await page.type(selector, char, { delay: Math.random() * 100 + 50 });
    await randomDelay(100, 300);
  }
};

(async () => {
  try {
    // ディレクトリ作成
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
      console.log('📂 プロファイルディレクトリ作成:', PROFILE_DIR);
    }

    console.log('🚀 Instagram ログイン開始...');
    console.log('📧 ユーザー:', USERNAME);

    const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 720 },
      // ステルスモード（ボット検出対策）
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-sync',
      ],
      // User Agentを完全に偽装
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezone: 'Asia/Tokyo',
    });

    const page = await browser.newPage();
    
    // Webドライバー検出対策
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    console.log('🌐 Instagramにアクセス中...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    await randomDelay(2000, 3000);

    // ログイン済みチェック
    const isLoggedIn = await page.url().includes('/') && 
                       !(await page.$('input[name="username"]'));
    
    if (isLoggedIn) {
      console.log('✅ 既にログイン済みです');
      await browser.close();
      process.exit(0);
    }

    console.log('🔓 ログイン画面に入力...');

    // ユーザー名を人間らしく入力
    console.log('👤 ユーザー名入力中...');
    await humanMouseMoveToElement(page, 'input[name="username"]');
    await humanTypeText(page, 'input[name="username"]', USERNAME);
    await randomDelay(800, 1200);

    // パスワードを人間らしく入力
    console.log('🔑 パスワード入力中...');
    await humanMouseMoveToElement(page, 'input[name="password"]');
    await humanTypeText(page, 'input[name="password"]', PASSWORD);
    await randomDelay(800, 1200);

    // ログインボタンをクリック
    console.log('📨 ログインボタンクリック中...');
    await humanMouseMoveToElement(page, 'button[type="button"]');
    await page.click('button[type="button"]');

    console.log('⏳ ログイン処理中（30秒待機）...');
    
    // OTPが必要か確認（最大30秒）
    let otpRequired = false;
    try {
      await page.waitForSelector('input[aria-label*="code"]', { timeout: 15000 }).catch(() => {});
      otpRequired = await page.$('input[aria-label*="code"]') !== null;
    } catch (e) {
      // OTP不要の場合
    }

    if (otpRequired) {
      console.log('⚠️ OTP認証が必要です。ブラウザで入力してください。');
      console.log('⏳ 60秒間待機中...');
      await randomDelay(60000, 70000);
    } else {
      console.log('✓ OTP不要または自動認証');
      await randomDelay(3000, 5000);
    }

    // ホーム画面確認
    console.log('🔍 ホーム画面確認中...');
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log('📊 最終URL:', finalUrl);

    if (finalUrl.includes('instagram.com/') && !finalUrl.includes('accounts/login')) {
      console.log('✅ ログイン成功！');
      console.log('💾 ブラウザプロファイルに自動保存されました');
      console.log('📂 プロファイル場所:', PROFILE_DIR);
    } else {
      console.log('⚠️ ログイン状況が不確定です');
      console.log('💾 プロファイルに状態を保存しました');
    }

    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
})();
