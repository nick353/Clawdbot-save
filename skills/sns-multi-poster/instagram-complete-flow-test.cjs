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
    const testImage = '/root/clawd/test-images/test.png';
    if (!fs.existsSync(testImage)) {
      throw new Error(`❌ テスト画像が見つかりません: ${testImage}`);
    }
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testImage);
    console.log('✅ ファイルアップロード成功');
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-uploaded.png', fullPage: true });

    // Step 4: Next ボタンをクリック (1回目)
    console.log('📝 Step 4: Next ボタンをクリック (1回目)');
    let nextBtn = page.locator('button:has-text("Next")').first();
    if (!(await nextBtn.isVisible({ timeout: 10000 }))) {
      throw new Error('❌ Next ボタンが見つかりません');
    }
    await nextBtn.click();
    await page.waitForTimeout(3000);
    console.log('✅ Next (1回目) をクリックしました');
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-after-next-1.png', fullPage: true });

    // Step 5: Next ボタンをクリック (2回目 - キャプション画面へ)
    console.log('📝 Step 5: Next ボタンをクリック (2回目)');
    nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 5000 })) {
      await nextBtn.click();
      await page.waitForTimeout(3000);
      console.log('✅ Next (2回目) をクリックしました');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-caption-screen.png', fullPage: true });
    } else {
      console.log('ℹ️ 2回目のNextボタンはスキップされました（キャプション画面に直接遷移）');
    }

    // Step 6: キャプションを入力
    console.log('📝 Step 6: キャプションを入力');
    const captionTextarea = page.locator('textarea[aria-label*="caption"], textarea[placeholder*="caption"]').first();
    if (await captionTextarea.isVisible({ timeout: 5000 })) {
      await captionTextarea.fill('🎉 テスト投稿です！\n\n#test #instagram #automation');
      console.log('✅ キャプションを入力しました');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-caption-filled.png', fullPage: true });
    } else {
      console.log('⚠️ キャプション入力欄が見つかりませんでした');
    }

    // Step 7: Share ボタンを確認（クリックはしない - DRY RUN）
    console.log('📝 Step 7: Share ボタンを確認');
    const shareBtn = page.locator('button:has-text("Share")').first();
    if (await shareBtn.isVisible({ timeout: 5000 })) {
      console.log('✅ Share ボタンを発見しました！');
      console.log('🎉 完全な投稿フローが動作することを確認しました！');
      console.log('ℹ️ DRY RUNのため、実際の投稿はスキップしました');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-ready-to-share.png', fullPage: true });
    } else {
      console.log('⚠️ Share ボタンが見つかりませんでした');
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-no-share-button.png', fullPage: true });
    }

    console.log('=========================================');
    console.log('✅ 完全なフローのテストが完了しました！');
    console.log('=========================================');

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-flow-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
