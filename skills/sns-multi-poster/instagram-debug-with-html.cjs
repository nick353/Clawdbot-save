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

async function saveDebugInfo(page, step) {
  const timestamp = Date.now();
  const screenshotPath = `/tmp/sns-ui-debug/instagram-${step}-${timestamp}.png`;
  const htmlPath = `/tmp/sns-ui-debug/instagram-${step}-${timestamp}.html`;
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(htmlPath, html);
  
  console.log(`📸 Screenshot: ${screenshotPath}`);
  console.log(`📄 HTML: ${htmlPath}`);
  
  return { screenshotPath, htmlPath };
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

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

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
    await saveDebugInfo(page, 'step0-top-page');

    await page.waitForTimeout(3000);

    console.log('📝 Step 1: Create ボタンをクリック');
    const createButton = page.locator('a:has-text("Create")').first();
    if (!(await createButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Create ボタンが見つかりません');
    }
    await createButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Create メニューを開きました');
    await saveDebugInfo(page, 'step1-create-menu');

    console.log('📝 Step 2: Post ボタンをクリック');
    const postButton = page.locator('text="Post"').first();
    if (!(await postButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Post ボタンが見つかりません');
    }
    await postButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Post ダイアログを開きました');
    await saveDebugInfo(page, 'step2-post-dialog');

    console.log('📝 Step 3: 画像をアップロード');
    const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
    if (!fs.existsSync(testImage)) {
      throw new Error(`❌ テスト画像が見つかりません: ${testImage}`);
    }
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImage);
    console.log('✅ ファイルアップロード成功');
    
    console.log('⏳ 画像処理を待機中...');
    await page.waitForTimeout(5000);
    await saveDebugInfo(page, 'step3-after-upload-5s');
    
    await page.waitForTimeout(5000);
    await saveDebugInfo(page, 'step3-after-upload-10s');
    
    await page.waitForTimeout(5000);
    await saveDebugInfo(page, 'step3-after-upload-15s');

    // Next ボタンの存在確認（HTMLも詳細に調査）
    console.log('🔍 Next ボタンを調査中...');
    const html = await page.content();
    const hasNextText = html.includes('Next');
    console.log(`HTML内に "Next" 文字列: ${hasNextText}`);
    
    const nextButtons = await page.$$('text="Next"');
    console.log(`"Next" にマッチする要素数: ${nextButtons.length}`);
    
    const nextButtonsDiv = await page.$$('div:has-text("Next")');
    console.log(`div:has-text("Next") にマッチする要素数: ${nextButtonsDiv.length}`);

    console.log('📝 Step 4: Next ボタンをクリック（直前のデバッグ情報）');
    await saveDebugInfo(page, 'step4-before-next-click');
    
    let nextBtn = page.locator('div:has-text("Next"):not(:has(div))').first();
    if (!(await nextBtn.isVisible({ timeout: 3000 }))) {
      nextBtn = page.locator('text="Next"').first();
    }
    
    if (await nextBtn.isVisible({ timeout: 10000 })) {
      console.log('✅ Next ボタンが見つかりました。クリックします...');
      await nextBtn.click();
      console.log('✅ Next ボタンをクリックしました');
      
      // クリック直後のデバッグ情報
      await page.waitForTimeout(1000);
      await saveDebugInfo(page, 'step4-after-next-click-1s');
      
      await page.waitForTimeout(2000);
      await saveDebugInfo(page, 'step4-after-next-click-3s');
      
      // エラーダイアログの確認
      const errorDialog = page.locator('text="Something went wrong"');
      if (await errorDialog.isVisible({ timeout: 2000 })) {
        console.log('⚠️ エラーダイアログが表示されました');
        await saveDebugInfo(page, 'step4-error-dialog');
        
        // エラーメッセージの詳細を取得
        const errorHtml = await page.content();
        const errorLines = errorHtml.split('\n').filter(line => 
          line.includes('error') || 
          line.includes('Something went wrong') ||
          line.includes('try again')
        );
        console.log('🔍 エラー関連のHTML:');
        errorLines.forEach(line => console.log(line.trim()));
      }
      
    } else {
      throw new Error('❌ Next ボタンが見つかりません');
    }

    console.log('=========================================');
    console.log('✅ デバッグ情報の収集が完了しました');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await saveDebugInfo(page, 'error');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
