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
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
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
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    console.log('🌐 Instagram トップページにアクセス中...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    console.log('🌐 /create/ にアクセス中...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    console.log(`現在のURL: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('❌ Cookies are invalid - still on login page');
    }
    
    if (currentUrl.includes('/create/')) {
      console.log('❌ /create/ はユーザープロフィールページになっています');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-create-page-profile.png', fullPage: true });
      throw new Error('/create/ is a user profile page');
    }
    
    console.log('✅ 正しいページに到達しました');

    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-create-page-v3.png', fullPage: true });

    console.log('🔍 ファイル入力要素を探しています...');
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`ファイル入力総数: ${fileInputs.length}`);
    
    if (fileInputs.length > 0) {
      console.log('✅ ファイル入力要素が見つかりました！');
      const testImage = '/root/clawd/test-images/test.png';
      
      if (fs.existsSync(testImage)) {
        console.log('📁 画像をアップロード中...');
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(testImage);
        console.log('✅ ファイルアップロード成功');
        
        console.log('⏳ Nextボタンを待機中（最大15秒）...');
        let nextVisible = false;
        for (let i = 0; i < 15; i++) {
          const nextBtn = page.locator('div:has-text("Next"):not(:has(div))').first();
          try {
            if (await nextBtn.isVisible({ timeout: 1000 })) {
              nextVisible = true;
              console.log(`✅ Next ボタンが表示されました（${i + 1}秒後）`);
              break;
            }
          } catch {
            if (i % 3 === 0) {
              console.log(`  まだ待機中... (${i}秒)`);
            }
          }
        }
        
        if (nextVisible) {
          await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-with-next-button.png', fullPage: true });
          console.log('🎉 成功！画像アップロードとNextボタンの表示を確認しました！');
        } else {
          console.log('⚠️ Nextボタンが表示されませんでした');
          await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-no-next-after-upload.png', fullPage: true });
        }
      } else {
        console.log('⚠️ テスト画像が見つかりません');
      }
    } else {
      console.log('⚠️ ファイル入力要素が見つかりませんでした');
      const html = await page.content();
      fs.writeFileSync('/tmp/sns-ui-debug/instagram-create-page-v3.html', html);
    }

    console.log('=========================================');
    console.log('✅ 完了');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-direct-create-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
