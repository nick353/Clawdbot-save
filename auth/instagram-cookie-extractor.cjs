const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🔐 Instagram Cookie 取得開始...\n');
  console.log('📝 手順:');
  console.log('1. VNC ブラウザが開きます（http://localhost:6080 に接続してください）');
  console.log('2. Instagram.com にログインしてください');
  console.log('3. ログイン完了後、このスクリプトは自動的に Cookie を抽出します\n');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--display=:99',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Instagram にナビゲート
  await page.goto('https://www.instagram.com/accounts/login/');
  
  console.log('⏳ Instagram ログインページを開きました...');
  console.log('🌐 VNC でログインしてください（クッキーが自動保存されます）');
  console.log('💡 ログイン完了後、Enter キーを押してください\n');

  // ユーザーの入力を待つ
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Cookie を取得
  const cookies = await context.cookies();
  
  if (cookies.length === 0) {
    console.error('❌ Cookie が取得できませんでした。ログインしましたか？');
    process.exit(1);
  }

  // Cookie ファイルに保存
  const cookieFile = path.join('/root/clawd/auth', 'instagram.json');
  fs.writeFileSync(cookieFile, JSON.stringify({ cookies }, null, 2));
  
  console.log(`✅ Cookie を保存しました: ${cookieFile}`);
  console.log(`📊 ${cookies.length} 個の Cookie を取得\n`);

  // 主要な Cookie を表示
  const importantCookies = ['sessionid', 'csrftoken', 'ds_user_id'];
  importantCookies.forEach(name => {
    const cookie = cookies.find(c => c.name === name);
    if (cookie) {
      console.log(`✓ ${name}: ${cookie.value.substring(0, 20)}...`);
    }
  });

  await browser.close();
  console.log('\n✅ Cookie 取得完了！\n');
})();
