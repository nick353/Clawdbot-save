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

    await page.waitForTimeout(3000);

    // Step 1: Create ボタンをクリック
    console.log('📝 Step 1: Create ボタンをクリック');
    const createButton = page.locator('a:has-text("Create")').first();
    if (!(await createButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Create ボタンが見つかりません');
    }
    await createButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Create メニューを開きました');

    // Step 2: Post ボタンをクリック
    console.log('📝 Step 2: Post ボタンをクリック');
    const postButton = page.locator('text="Post"').first();
    if (!(await postButton.isVisible({ timeout: 5000 }))) {
      throw new Error('❌ Post ボタンが見つかりません');
    }
    await postButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Post ダイアログを開きました');

    // Step 3: 画像をアップロード
    console.log('📝 Step 3: 画像をアップロード');
    
    // より良い画像を作成（既存のtest-image.jpgを使う）
    const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
    if (!fs.existsSync(testImage)) {
      throw new Error(`❌ テスト画像が見つかりません: ${testImage}`);
    }
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImage);
    console.log('✅ ファイルアップロード成功');
    
    // より長く待機（10秒）
    console.log('⏳ 画像処理を待機中（10秒）...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-uploaded-with-wait.png', fullPage: true });

    // エラーダイアログをチェック
    const errorDialog = page.locator('text="Something went wrong"');
    if (await errorDialog.isVisible({ timeout: 2000 })) {
      console.log('⚠️ エラーダイアログが表示されました。再試行ボタンをクリックします...');
      const tryAgainBtn = page.locator('button:has-text("Try again")');
      if (await tryAgainBtn.isVisible({ timeout: 2000 })) {
        await tryAgainBtn.click();
        await page.waitForTimeout(3000);
        console.log('✅ 再試行しました');
        
        // 再度ファイルをアップロード
        const fileInput2 = page.locator('input[type="file"]').first();
        if (await fileInput2.isVisible({ timeout: 2000 })) {
          await fileInput2.setInputFiles(testImage);
          console.log('✅ ファイルを再アップロードしました');
          await page.waitForTimeout(10000);
        }
      }
    }

    // Step 4: Next ボタンをクリック (1回目)
    console.log('📝 Step 4: Next ボタンをクリック (1回目)');
    
    let nextBtn = page.locator('div:has-text("Next"):not(:has(div))').first();
    if (!(await nextBtn.isVisible({ timeout: 3000 }))) {
      nextBtn = page.locator('text="Next"').first();
    }
    
    if (await nextBtn.isVisible({ timeout: 10000 })) {
      await nextBtn.click();
      console.log('✅ Next (1回目) をクリックしました');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-next-1-with-handling.png', fullPage: true });
    } else {
      throw new Error('❌ Next ボタンが見つかりません');
    }

    // Step 5: Next ボタンをクリック (2回目)
    console.log('📝 Step 5: Next ボタンをクリック (2回目)');
    nextBtn = page.locator('div:has-text("Next"):not(:has(div))').first();
    if (!(await nextBtn.isVisible({ timeout: 2000 }))) {
      nextBtn = page.locator('text="Next"').first();
    }
    
    if (await nextBtn.isVisible({ timeout: 5000 })) {
      await nextBtn.click();
      await page.waitForTimeout(3000);
      console.log('✅ Next (2回目) をクリックしました');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-caption-screen-final.png', fullPage: true });
    } else {
      console.log('ℹ️ 2回目のNextボタンはスキップされました');
    }

    // Step 6: キャプションを入力
    console.log('📝 Step 6: キャプションを入力');
    const captionSelectors = [
      'textarea[aria-label*="caption"]',
      'textarea[placeholder*="caption"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ];
    
    let captionInput = null;
    for (const selector of captionSelectors) {
      captionInput = page.locator(selector).first();
      if (await captionInput.isVisible({ timeout: 2000 })) {
        console.log(`✅ キャプション入力欄を発見: ${selector}`);
        break;
      }
    }
    
    if (captionInput && await captionInput.isVisible({ timeout: 2000 })) {
      await captionInput.fill('🎉 テスト投稿です！\n\n#test #instagram #automation');
      console.log('✅ キャプションを入力しました');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-caption-filled-final.png', fullPage: true });
    } else {
      console.log('⚠️ キャプション入力欄が見つかりませんでした');
      const html = await page.content();
      fs.writeFileSync('/tmp/sns-ui-debug/instagram-caption-page.html', html);
    }

    // Step 7: Share ボタンを確認
    console.log('📝 Step 7: Share ボタンを確認');
    const shareBtn = page.locator('div:has-text("Share"):not(:has(div))').first();
    let shareBtnVisible = await shareBtn.isVisible({ timeout: 3000 });
    
    if (!shareBtnVisible) {
      const shareBtn2 = page.locator('button:has-text("Share")').first();
      shareBtnVisible = await shareBtn2.isVisible({ timeout: 3000 });
    }
    
    if (shareBtnVisible) {
      console.log('✅ Share ボタンを発見しました！');
      console.log('🎉 完全な投稿フローが動作することを確認しました！');
      console.log('ℹ️ DRY RUNのため、実際の投稿はスキップしました');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-ready-to-share-final.png', fullPage: true });
    } else {
      console.log('⚠️ Share ボタンが見つかりませんでした');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-no-share-button-final.png', fullPage: true });
    }

    console.log('=========================================');
    console.log('✅ 完全なフローのテストが完了しました！');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-final-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
