const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.dirname(__filename);
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'instagram-storage-state.json');
const PROFILE_FILE = path.join(AUTH_DIR, 'instagram.json');

(async () => {
  console.log('\n🌐 Instagram ブラウザ セッション起動...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 ブラウザが起動します。');
  console.log('🔐 Instagram にログインしてください。');
  console.log('⚠️  OTP(ワンタイムパスワード)を入力してください。');
  console.log('✅ ログイン完了後、このスクリプトの実行を待機してください。');
  console.log('');
  console.log('🔌 "Ctrl+C を押してブラウザを閉じてください"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Instagram へナビゲート
  console.log('⏳ Instagram にアクセス中...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });

  // ユーザーがログインするのを待機（60分タイムアウト）
  console.log('\n⏳ ユーザー入力を待機中... (タイムアウト: 60分)');
  console.log('💡 ハント: ログイン後、プロンプトが自動で閉じるまで待機してください。\n');

  let isLoggedIn = false;
  const maxAttempts = 360; // 60分 × 60秒
  let attempts = 0;

  while (!isLoggedIn && attempts < maxAttempts) {
    await page.waitForTimeout(10000); // 10秒待機

    // ログイン確認: /accounts/edit/ にリダイレクトされるか確認
    const currentUrl = page.url();
    const cookies = await context.cookies();
    const sessionIdExists = cookies.some(c => c.name === 'sessionid');

    if (sessionIdExists && (currentUrl.includes('instagram.com') && !currentUrl.includes('/accounts/login/'))) {
      console.log('✅ ログイン成功を確認!');
      isLoggedIn = true;
      break;
    }

    attempts++;
    if (attempts % 6 === 0) { // 60秒ごと
      console.log(`⏳ 待機中... (${attempts * 10}秒経過)`);
    }
  }

  if (!isLoggedIn) {
    console.log('\n⚠️  ログイン確認タイムアウト');
  }

  // ストレージ状態を保存
  console.log('\n💾 セッション情報を保存中...');
  const storageState = await context.storageState();
  fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(storageState, null, 2));
  console.log(`✅ 保存: ${STORAGE_STATE_FILE}`);

  // プロファイルJSON生成
  const profile = {
    type: 'instagram',
    method: 'playwright-remote',
    timestamp: new Date().toISOString(),
    storageState: storageState,
    cookies: {
      sessionid: storageState.cookies.find(c => c.name === 'sessionid')?.value || null,
      csrftoken: storageState.cookies.find(c => c.name === 'csrftoken')?.value || null,
    }
  };

  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
  console.log(`✅ プロファイル保存: ${PROFILE_FILE}`);

  // ブラウザを閉じる
  console.log('\n🛑 ブラウザを閉じています...');
  await browser.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ セッション生成完了!');
  console.log(`📁 プロファイル: ${PROFILE_FILE}`);
  console.log(`📁 ストレージ状態: ${STORAGE_STATE_FILE}`);
  console.log('次のステップ: post-to-instagram-v5.cjs で自動投稿テスト可能');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
})().catch(error => {
  console.error('\n❌ エラー:', error.message);
  process.exit(1);
});
