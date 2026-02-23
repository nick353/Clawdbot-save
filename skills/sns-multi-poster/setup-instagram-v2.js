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
    await page.waitForTimeout(2000);
    
    // ページテキストを取得
    const bodyText = await page.innerText('body');
    const isLoggedIn = bodyText.includes('Home') || bodyText.includes('Profile');
    
    if (isLoggedIn) {
      console.log('✅ 既にログイン済みです');
      await browser.close();
      return;
    }
    
    console.log('🔓 ログイン画面に入力...');
    await page.fill('input[name="email"]', USERNAME);
    await page.fill('input[name="pass"]', PASSWORD);
    console.log(`✓ ${USERNAME} でログイン処理開始...`);
    
    // パスワードフィールドでエンターキー
    await page.press('input[name="pass"]', 'Enter');
    
    console.log('⏳ ページ読み込み中（15秒待機）...');
    await page.waitForTimeout(15000);
    
    // ページの最終状態を取得
    const finalText = await page.innerText('body');
    const url = page.url();
    
    console.log(`\n📊 最終状態:`);
    console.log(`  URL: ${url}`);
    
    // 各種画面を判定
    if (finalText.includes('Home') || finalText.includes('home')) {
      console.log('  ✅ ホーム画面: 検出');
      console.log('\n✅ ログイン成功！');
    } else if (finalText.includes('verification code') || finalText.includes('認証コード') || finalText.includes('code')) {
      console.log('  📱 OTP画面: 検出');
      console.log('\n📋 【OTP確認が必要です】');
      console.log('   1. Instagramから認証コード（6桁）がメールで送付されます');
      console.log('   2. 認証コードをDiscordで教えてください');
      console.log('   3. スクリプトが検出して自動で入力します\n');
      
      // OTP入力フィールドの状態を確認
      const otpInputs = await page.locator('input[inputmode="numeric"], input[type="number"]').all();
      console.log(`   入力フィールド: ${otpInputs.length}個検出`);
      
    } else if (finalText.includes('Your account')) {
      console.log('  ⚠️ アカウント情報画面: 検出');
    } else if (finalText.includes('password') || finalText.includes('pass')) {
      console.log('  ❌ ログイン失敗: パスワード入力画面のまま');
    } else {
      console.log('  ？ 不明な画面');
      console.log(`   テキスト長: ${finalText.length}`);
    }
    
    console.log('\n💾 ブラウザプロファイルに状態を保存しました');
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
