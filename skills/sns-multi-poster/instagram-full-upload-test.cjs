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

    console.log('🔍 Createボタンを探しています（複数パターン）...');
    
    // パターン1: text="Create" を含むリンク
    let createButton = page.locator('a:has-text("Create")').first();
    let found = false;
    
    try {
      if (await createButton.isVisible({ timeout: 2000 })) {
        console.log('✅ Createボタンを発見（パターン1: :has-text）');
        found = true;
      }
    } catch (e) {
      console.log('⚠️ パターン1では見つかりませんでした');
    }
    
    // パターン2: 「+」アイコンを探す
    if (!found) {
      createButton = page.locator('svg[aria-label*="New post"]').locator('..').locator('..');
      try {
        if (await createButton.isVisible({ timeout: 2000 })) {
          console.log('✅ Createボタンを発見（パターン2: SVG aria-label）');
          found = true;
        }
      } catch (e) {
        console.log('⚠️ パターン2では見つかりませんでした');
      }
    }
    
    // パターン3: href="#" で text に "Create" を含むリンク
    if (!found) {
      const allLinks = await page.$$('a[href="#"]');
      for (const link of allLinks) {
        const text = await link.textContent();
        if (text && text.includes('Create')) {
          createButton = page.locator(`a[href="#"]:has-text("Create")`).first();
          console.log('✅ Createボタンを発見（パターン3: href="#" + text）');
          found = true;
          break;
        }
      }
    }

    if (found) {
      console.log('🖱️ Create ボタンをクリック...');
      await createButton.click();
      console.log('⏳ ファイル選択ダイアログを待機...');
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-create-click-v2.png', fullPage: true });
      
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
          await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-upload-v2.png', fullPage: true });
          console.log('📸 アップロード後のスクリーンショット撮影完了');
          
          console.log('🔍 Next ボタンを探しています...');
          const nextBtn = page.locator('button:has-text("Next")').first();
          if (await nextBtn.isVisible({ timeout: 5000 })) {
            console.log('✅ Next ボタンを発見');
            await nextBtn.click();
            console.log('🖱️ Next ボタンをクリック');
            
            await page.waitForTimeout(2000);
            await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-next.png', fullPage: true });
            console.log('📸 Next後のスクリーンショット撮影完了');
          } else {
            console.log('⚠️ Next ボタンが見つかりませんでした');
          }
        } else {
          console.log('⚠️ テスト画像が見つかりません');
        }
      } else {
        console.log('⚠️ まだファイル入力要素が見つかりません');
        const html = await page.content();
        fs.writeFileSync('/tmp/sns-ui-debug/instagram-after-create-click-v2.html', html);
      }
    } else {
      console.log('❌ Create ボタンが見つかりませんでした');
    }

    console.log('=========================================');
    console.log('✅ 完了');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-error-3.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
