const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      console.log(`✅ Loaded ${cookies.length} cookies`);
      return cookies;
    } catch (e) {
      console.warn('⚠️ Failed to parse cookies');
      return [];
    }
  }
  return [];
}

(async () => {
  let browser, context, page;
  try {
    console.log('🚀 ブラウザ起動中...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      executablePath: '/usr/bin/chromium-browser'
    });

    context = await browser.newContext();

    // Load cookies
    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    page = await context.newPage();
    page.setDefaultTimeout(30000);

    console.log('🌐 Instagram /create にアクセス中...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('❌ Cookies are invalid - still on login page');
    }
    console.log('✅ /create loaded successfully');

    // Wait for page to render
    await page.waitForTimeout(2000);

    console.log('📸 スクリーンショット撮影...');
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-create-page.png', fullPage: true });

    console.log('🔍 ファイル入力要素を探しています...');
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`ファイル入力総数: ${fileInputs.length}`);

    if (fileInputs.length > 0) {
      console.log('✅ ファイル入力要素が見つかりました！');
      console.log('🖼️ テスト画像をアップロードしてみます...');
      
      const testImage = '/root/clawd/test-images/test.png';
      if (fs.existsSync(testImage)) {
        await fileInputs[0].setInputFiles(testImage);
        console.log('✅ ファイルアップロード成功');
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-upload.png', fullPage: true });
        console.log('📸 アップロード後のスクリーンショット撮影完了');
      } else {
        console.log('⚠️ テスト画像が見つかりません');
      }
    } else {
      console.log('⚠️ ファイル入力要素が見つかりません。HTMLを保存...');
      const html = await page.content();
      fs.writeFileSync('/tmp/sns-ui-debug/instagram-create-page.html', html);
    }

    console.log('=========================================');
    console.log('✅ 完了');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
