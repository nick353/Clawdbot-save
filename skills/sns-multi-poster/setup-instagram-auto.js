const { chromium } = require('playwright');
const path = require('path');

const USERNAME = 'nisen_prints';
const PASSWORD = process.env.IG_PASSWORD || '';

(async () => {
  console.log('🔐 Instagram ログイン自動セットアップ開始...');
  
  if (!PASSWORD) {
    console.error('❌ IG_PASSWORD 環境変数が未設定です');
    process.exit(1);
  }
  
  const profilePath = path.join(__dirname, 'browser-profile');
  
  const browser = await chromium.launchPersistentContext(profilePath, {
    headless: false,  // ヘッドレスモード無効化（デバッグ用）
    viewport: { width: 1280, height: 720 }
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();
    
    console.log('📂 Instagram.comにアクセス...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // ログイン状態を確認
    const isLoggedIn = await page.locator('a[href*="/direct/"], svg[aria-label*="Home"], a[href="/explore/"]').count() > 0;
    
    if (isLoggedIn) {
      console.log('✅ 既にログイン済みです！');
      console.log('📋 ログイン状態がブラウザプロファイルに保存されています');
      await browser.close();
      process.exit(0);
    }
    
    console.log('🔓 ログイン画面が表示されました');
    console.log('📝 ユーザー名を入力...');
    
    // ユーザー名フィールドを探す
    const usernameInput = page.locator('input[name="username"], input[placeholder*="username"], input[type="text"]').first();
    await usernameInput.fill(USERNAME);
    console.log(`✓ ユーザー名入力: ${USERNAME}`);
    
    // パスワードフィールドを探す
    console.log('🔑 パスワードを入力...');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(PASSWORD);
    console.log('✓ パスワード入力完了');
    
    // ログインボタンをクリック
    console.log('🖱️ ログインボタンをクリック...');
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("ログイン")');
    
    // ログイン完了を待つ
    console.log('⏳ ログイン処理を待機（最大30秒）...');
    try {
      await page.waitForSelector('a[href*="/direct/"], svg[aria-label*="Home"], a[href="/explore/"]', { timeout: 30000 });
      console.log('✅ ログイン成功！');
      
      // ポップアップを処理
      await page.waitForTimeout(1000);
      
      // "情報を保存しますか？"を処理
      const saveButtons = page.locator('button:has-text("Not now"), button:has-text("Save"), button:has-text("後で"), button:has-text("保存しない")');
      if (await saveButtons.count() > 0) {
        console.log('💾 セーブダイアログを処理...');
        await saveButtons.first().click();
        await page.waitForTimeout(1000);
      }
      
      // "通知を有効にしますか？"を処理
      const notifButtons = page.locator('button:has-text("Not Now"), button:has-text("Allow"), button:has-text("許可"), button:has-text("後で")');
      if (await notifButtons.count() > 0) {
        console.log('🔔 通知ダイアログを処理...');
        await notifButtons.first().click();
        await page.waitForTimeout(1000);
      }
      
      console.log('\n✅ セットアップ完了！');
      console.log('🎉 ブラウザプロファイルにログイン状態が保存されました');
      
    } catch (error) {
      console.warn('⚠️ ログイン完了の確認タイムアウト（OTP待機中？）');
      console.log('📋 手動でOTPコードを入力してください');
      console.log('   スクリプトは開いたままです。OTP入力後、自動で続行します...');
      
      // OTP画面まで進んだと思われるので、手動操作を待つ
      try {
        await page.waitForNavigation({ timeout: 120000 });
        console.log('✅ OTP確認後のナビゲーション完了');
      } catch (e) {
        console.log('⏱️ 操作タイムアウト');
      }
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
  } finally {
    await browser.close();
  }
})();
