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

    await page.waitForTimeout(3000);

    console.log('📝 Step 1: Create ボタンをクリック');
    const createButton = page.locator('a:has-text("Create")').first();
    if (!(await createButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Create ボタンが見つかりません');
    }
    await createButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Create メニューを開きました');

    console.log('📝 Step 2: Post ボタンをクリック');
    const postButton = page.locator('text="Post"').first();
    if (!(await postButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Post ボタンが見つかりません');
    }
    await postButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Post ダイアログを開きました');

    console.log('📝 Step 3: 画像をアップロード');
    const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
    if (!fs.existsSync(testImage)) {
      throw new Error(`❌ テスト画像が見つかりません: ${testImage}`);
    }
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImage);
    console.log('✅ ファイルアップロード成功');
    
    console.log('⏳ 画像処理を待機中（15秒）...');
    await page.waitForTimeout(15000);
    
    // HTML保存
    console.log('📄 アップロード後のHTMLを保存中...');
    const htmlAfterUpload = await page.content();
    fs.writeFileSync('/tmp/sns-ui-debug/instagram-after-upload.html', htmlAfterUpload);
    console.log('✅ HTML保存完了');

    // Next ボタンの詳細調査
    console.log('🔍 Next ボタンを調査中...');
    const hasNextText = htmlAfterUpload.includes('Next');
    console.log(`HTML内に "Next" 文字列: ${hasNextText}`);
    
    if (hasNextText) {
      const nextMatches = htmlAfterUpload.match(/Next/g);
      console.log(`"Next" の出現回数: ${nextMatches ? nextMatches.length : 0}`);
      
      // Nextを含む行を抽出
      const linesWithNext = htmlAfterUpload.split('\n').filter(line => line.includes('Next'));
      console.log(`"Next" を含む行数: ${linesWithNext.length}`);
      console.log('最初の5行:');
      linesWithNext.slice(0, 5).forEach((line, i) => {
        console.log(`  ${i + 1}. ${line.trim().substring(0, 100)}...`);
      });
    }

    // Nextボタンの要素を取得
    const nextButtons = await page.$$('text="Next"');
    console.log(`"Next" にマッチする要素数: ${nextButtons.length}`);
    
    for (let i = 0; i < Math.min(nextButtons.length, 3); i++) {
      try {
        const isVisible = await nextButtons[i].isVisible();
        const isEnabled = await nextButtons[i].isEnabled();
        console.log(`  Next要素 ${i + 1}: visible=${isVisible}, enabled=${isEnabled}`);
      } catch (e) {
        console.log(`  Next要素 ${i + 1}: エラー - ${e.message}`);
      }
    }

    console.log('📝 Step 4: Next ボタンをクリック');
    let nextBtn = page.locator('div:has-text("Next"):not(:has(div))').first();
    if (!(await nextBtn.isVisible({ timeout: 3000 }))) {
      nextBtn = page.locator('text="Next"').first();
    }
    
    if (await nextBtn.isVisible({ timeout: 10000 })) {
      console.log('✅ Next ボタンが見つかりました。クリックします...');
      await nextBtn.click();
      console.log('✅ Next ボタンをクリックしました');
      
      // クリック直後のHTML保存
      await page.waitForTimeout(3000);
      console.log('📄 クリック後のHTMLを保存中...');
      const htmlAfterClick = await page.content();
      fs.writeFileSync('/tmp/sns-ui-debug/instagram-after-next-click.html', htmlAfterClick);
      console.log('✅ HTML保存完了');
      
      // エラーダイアログの確認
      const errorDialog = page.locator('text="Something went wrong"');
      if (await errorDialog.isVisible({ timeout: 2000 })) {
        console.log('⚠️ エラーダイアログが表示されました');
        
        // エラーダイアログのHTML保存
        const htmlError = await page.content();
        fs.writeFileSync('/tmp/sns-ui-debug/instagram-error-dialog.html', htmlError);
        
        // エラーメッセージの詳細を取得
        const errorLines = htmlError.split('\n').filter(line => 
          line.includes('error') || 
          line.includes('Something went wrong') ||
          line.includes('try again') ||
          line.includes('Please try again')
        );
        console.log('🔍 エラー関連のHTML行数:', errorLines.length);
        errorLines.slice(0, 10).forEach((line, i) => {
          console.log(`  ${i + 1}. ${line.trim().substring(0, 150)}`);
        });
      } else {
        console.log('✅ エラーダイアログは表示されませんでした');
      }
      
    } else {
      throw new Error('❌ Next ボタンが見つかりません');
    }

    console.log('=========================================');
    console.log('✅ HTMLデバッグ情報の収集が完了しました');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      const htmlError = await page.content();
      fs.writeFileSync('/tmp/sns-ui-debug/instagram-final-error.html', htmlError);
      console.log('📄 エラー時のHTMLを保存しました');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
