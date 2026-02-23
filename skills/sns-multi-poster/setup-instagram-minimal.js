const { chromium } = require('playwright');
const path = require('path');

const USERNAME = 'nisen_prints';
const PASSWORD = process.env.IG_PASSWORD || '';

(async () => {
  console.log('🔐 Instagram ログイン開始');
  
  if (!PASSWORD) {
    console.error('❌ IG_PASSWORD が未設定');
    process.exit(1);
  }
  
  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, 'browser-profile'),
    { headless: true, viewport: { width: 1280, height: 720 } }
  );

  try {
    const page = browser.pages()[0];
    
    console.log('📂 Instagram にアクセス中...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // 既にログイン済みか確認
    const loggedIn = await page.evaluate(() => {
      return document.body.innerText.includes('Home') || 
             !!document.querySelector('a[href="/"]');
    });
    
    if (loggedIn) {
      console.log('✅ 既にログイン済みです');
      await browser.close();
      return;
    }
    
    console.log('🔓 ログイン画面に入力...');
    
    // ユーザー名・パスワード入力（Instagramは email/pass フィールド）
    await page.fill('input[name="email"]', USERNAME);
    await page.fill('input[name="pass"]', PASSWORD);
    console.log(`✓ ${USERNAME} でログイン中...`);
    
    // ログインボタンをクリック（またはエンターキー）
    try {
      await page.click('button[type="submit"]');
    } catch {
      // ボタンが見つからない場合はエンターキー
      await page.press('input[name="pass"]', 'Enter');
    }
    
    // ログイン完了または OTP 画面を待つ
    console.log('⏳ ログイン処理中...');
    
    try {
      // ホーム画面 = ログイン成功
      await page.waitForSelector('a[href="/"], svg[aria-label="Home"]', { timeout: 15000 });
      console.log('✅ ログイン成功！');
    } catch (e) {
      // OTP 画面の可能性
      const otpScreen = await page.evaluate(() => {
        return document.body.innerText.includes('verification code') ||
               document.body.innerText.includes('認証コード') ||
               !!document.querySelector('input[inputmode="numeric"]');
      });
      
      if (otpScreen) {
        console.log('\n📱 OTP 画面が表示されました');
        console.log('📋 Instagramから送付されたOTPコード（6桁）を教えてください');
        console.log('   Discordメッセージで入力してください\n');
        
        // OTP 入力を待つ（最大 5 分）
        await page.waitForSelector('input[inputmode="numeric"]', { timeout: 300000 });
        console.log('✅ OTP入力フィールドが検出されました（待機中）\n');
        
      } else {
        console.log('⚠️ ホーム画面が表示されませんでした');
      }
    }
    
    // ブラウザプロファイルにクッキーを保存したまま維持
    console.log('💾 ブラウザプロファイルにログイン状態が保存されました');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
