const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

(async () => {
  console.log('🔐 Instagram ログインセットアップ');
  console.log('ブラウザプロファイル: browser-profile\n');
  
  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, 'browser-profile'),
    {
      headless: true,
      viewport: { width: 1280, height: 720 }
    }
  );

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('📂 Instagram.comにアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // ログイン状態を確認
  console.log('🔍 ログイン状態を確認...');
  const isLoggedIn = await page.locator('a[href*="/direct/"], svg[aria-label*="Home"]').count() > 0;
  
  if (isLoggedIn) {
    console.log('✅ 既にログイン済みです！');
    await browser.close();
    rl.close();
    return;
  }
  
  console.log('❌ ログインが必要です');
  console.log('\n📝 Instagramの認証情報を使用...');
  
  const username = process.env.IG_USERNAME || 'nisen_prints';
  const password = process.env.IG_PASSWORD;
  
  console.log('\n🔐 ログイン処理を開始...');
  
  // ログインフォームを探す
  await page.waitForSelector('input[name="username"]', { timeout: 5000 });
  
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  
  console.log('🖱️ ログインボタンをクリック...');
  await page.click('button[type="submit"]');
  
  // ログイン完了を待つ
  console.log('⏳ ログイン処理を待機（最大30秒）...');
  try {
    await page.waitForSelector('a[href*="/direct/"], svg[aria-label*="Home"]', { timeout: 30000 });
    console.log('✅ ログイン成功！');
    
    // "情報を保存しますか？"を処理
    await page.waitForTimeout(2000);
    const saveInfoButton = page.locator('button:has-text("Not now"), button:has-text("保存しない")').first();
    if (await saveInfoButton.count() > 0) {
      console.log('💾 "情報を保存しない"をクリック...');
      await saveInfoButton.click();
      await page.waitForTimeout(1000);
    }
    
    // "通知を有効にしますか？"を処理
    const notificationButton = page.locator('button:has-text("Not Now"), button:has-text("後で")').first();
    if (await notificationButton.count() > 0) {
      console.log('🔔 "通知: 後で"をクリック...');
      await notificationButton.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('\n✅ セットアップ完了！');
    console.log('ブラウザプロファイルにログイン状態が保存されました。');
    
  } catch (error) {
    console.error('❌ ログイン失敗:', error.message);
    console.log('\n⚠️ 2段階認証が必要な可能性があります。');
    console.log('   手動でブラウザプロファイルにログインしてください。');
  }
  
  await browser.close();
  rl.close();
})();
