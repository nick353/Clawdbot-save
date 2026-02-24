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

    console.log('🌐 Instagram トップページにアクセス中...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('❌ Cookies are invalid - still on login page');
    }
    console.log('✅ トップページ読み込み成功');

    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-home.png', fullPage: true });

    console.log('🔍 Createボタンを探しています...');
    
    // Create ボタンを探す（複数のセレクタを試す）
    const createSelectors = [
      'a[href*="/create/"]',
      'a[aria-label*="Create"]',
      'a[aria-label*="新規"]',
      'text=Create',
      'role=link[name*="Create"]'
    ];

    let createButton = null;
    for (const selector of createSelectors) {
      try {
        createButton = page.locator(selector).first();
        if (await createButton.isVisible({ timeout: 2000 })) {
          console.log(`✅ Create ボタンを発見: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️ ${selector} では見つかりませんでした`);
      }
    }

    if (createButton && await createButton.isVisible()) {
      console.log('🖱️ Create ボタンをクリック...');
      await createButton.click();
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-create-click.png', fullPage: true });
      
      console.log('🔍 ファイル入力要素を探しています...');
      const fileInputs = await page.$$('input[type="file"]');
      console.log(`ファイル入力総数: ${fileInputs.length}`);
      
      if (fileInputs.length > 0) {
        console.log('✅ ファイル入力要素が見つかりました！');
        console.log('🖼️ テスト画像をアップロードしてみます...');
        
        const testImage = '/root/clawd/test-images/test.png';
        if (fs.existsSync(testImage)) {
          const fileInput = page.locator('input[type="file"]').first();
          await fileInput.setInputFiles(testImage);
          console.log('✅ ファイルアップロード成功');
          
          await page.waitForTimeout(5000);
          await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-upload.png', fullPage: true });
          console.log('📸 アップロード後のスクリーンショット撮影完了');
        } else {
          console.log('⚠️ テスト画像が見つかりません');
        }
      } else {
        console.log('⚠️ まだファイル入力要素が見つかりません');
        const html = await page.content();
        fs.writeFileSync('/tmp/sns-ui-debug/instagram-after-create-click.html', html);
      }
    } else {
      console.log('❌ Create ボタンが見つかりませんでした');
      
      // 全てのリンクを調査
      console.log('🔍 全てのリンクを調査しています...');
      const allLinks = await page.$$('a');
      console.log(`全リンク数: ${allLinks.length}`);
      
      for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
        const link = allLinks[i];
        const href = await link.getAttribute('href');
        const ariaLabel = await link.getAttribute('aria-label');
        const text = await link.textContent();
        console.log(`[${i}] href="${href}" aria-label="${ariaLabel}" text="${text}"`);
      }
    }

    console.log('=========================================');
    console.log('✅ 完了');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-error-2.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
