const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🔍 Instagram UI デバッグ（Cookie認証版）');
  
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Cookieを読み込み
  console.log('🔐 Cookieを読み込み中...');
  const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
  const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  await context.addCookies(cookiesData);
  console.log('✅ Cookie設定完了');

  const page = await context.newPage();
  
  console.log('📂 Instagram.comにアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // ログイン状態を確認
  console.log('🔍 ログイン状態を確認...');
  const currentUrl = page.url();
  console.log(`  現在のURL: ${currentUrl}`);
  
  if (currentUrl.includes('/accounts/login')) {
    console.error('❌ ログインページにリダイレクトされました');
    console.log('⚠️ Cookieが無効または期限切れの可能性があります');
    await page.screenshot({ path: '/tmp/instagram-login-page.png' });
    await browser.close();
    return;
  }
  
  console.log('✅ ログイン確認完了');
  
  // SVGのaria-labelを全て確認
  console.log('\n📋 全てのSVG（aria-label含む）:');
  const allSvgs = await page.locator('svg[aria-label]').all();
  console.log(`  総SVG数: ${allSvgs.length}個`);
  
  for (let i = 0; i < allSvgs.length; i++) {
    const ariaLabel = await allSvgs[i].getAttribute('aria-label');
    console.log(`  ${i + 1}. aria-label="${ariaLabel}"`);
  }
  
  // "New post" または "Create" を含むSVGを探す
  console.log('\n🔍 "New" または "Create" を含むSVGを探す...');
  const createSvgs = await page.locator('svg[aria-label*="New"], svg[aria-label*="Create"], svg[aria-label*="新規"]').all();
  console.log(`  見つかった数: ${createSvgs.length}個`);
  
  if (createSvgs.length === 0) {
    console.error('❌ 新規投稿SVGが見つかりません');
    
    // 全リンクを確認
    console.log('\n📋 全てのナビゲーションリンク:');
    const navLinks = await page.locator('nav a, [role="navigation"] a').all();
    for (let i = 0; i < Math.min(navLinks.length, 20); i++) {
      const href = await navLinks[i].getAttribute('href');
      const text = await navLinks[i].innerText().catch(() => '');
      console.log(`  ${i + 1}. href="${href}", text="${text}"`);
    }
    
    await page.screenshot({ path: '/tmp/instagram-no-create-button.png', fullPage: true });
    await browser.close();
    return;
  }
  
  // 最初のCreate SVGの親要素を探す
  const createSvg = createSvgs[0];
  const ariaLabel = await createSvg.getAttribute('aria-label');
  console.log(`✅ 新規投稿SVG発見: aria-label="${ariaLabel}"`);
  
  // 親要素（クリック可能な要素）を探す
  const parentLink = createSvg.locator('xpath=ancestor::a').first();
  const parentButton = createSvg.locator('xpath=ancestor::button').first();
  
  let clickable = null;
  if (await parentLink.count() > 0) {
    clickable = parentLink;
    console.log('✅ 親<a>要素発見');
  } else if (await parentButton.count() > 0) {
    clickable = parentButton;
    console.log('✅ 親<button>要素発見');
  } else {
    console.error('❌ クリック可能な親要素が見つかりません');
    await browser.close();
    return;
  }
  
  // クリック実行
  console.log('🖱️ クリック実行...');
  await clickable.click();
  
  // モーダルの読み込みを待つ
  console.log('⏳ モーダルの読み込みを待機（8秒）...');
  await page.waitForTimeout(8000);
  
  // ダイアログを探す
  console.log('\n📋 ダイアログを検索...');
  const dialogs = await page.locator('[role="dialog"]').all();
  console.log(`  ダイアログ数: ${dialogs.length}個`);
  
  if (dialogs.length === 0) {
    console.error('❌ ダイアログが見つかりません');
    await page.screenshot({ path: '/tmp/instagram-no-dialog.png', fullPage: true });
    await browser.close();
    return;
  }
  
  const dialog = dialogs[dialogs.length - 1];
  
  // ダイアログ内のテキスト
  const dialogText = await dialog.innerText();
  console.log('\n📝 ダイアログ内のテキスト:');
  console.log(dialogText.substring(0, 500));
  console.log('...');
  
  // 全input要素
  const inputs = await dialog.locator('input').all();
  console.log(`\n🔍 input要素: ${inputs.length}個`);
  
  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type');
    const accept = await inputs[i].getAttribute('accept');
    const isVisible = await inputs[i].isVisible();
    const isHidden = await inputs[i].isHidden();
    console.log(`  Input ${i + 1}: type="${type}", accept="${accept}", visible=${isVisible}, hidden=${isHidden}`);
  }
  
  // ページ全体のfile input
  console.log('\n🔍 ページ全体のfile input:');
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`  File input数: ${fileInputs.length}個`);
  
  for (let i = 0; i < fileInputs.length; i++) {
    const accept = await fileInputs[i].getAttribute('accept');
    const isVisible = await fileInputs[i].isVisible();
    const isHidden = await fileInputs[i].isHidden();
    console.log(`  File input ${i + 1}: accept="${accept}", visible=${isVisible}, hidden=${isHidden}`);
    
    if (!isHidden) {
      // 試しにファイルをセット（ダミーファイル）
      console.log('\n🧪 テスト: ファイル入力を試みる...');
      try {
        // ダミー画像を作成
        const testImagePath = '/tmp/test-image.jpg';
        if (!fs.existsSync(testImagePath)) {
          // 1x1の白いJPEG（最小サイズ）
          const base64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA==';
          fs.writeFileSync(testImagePath, Buffer.from(base64, 'base64'));
        }
        
        await fileInputs[i].setInputFiles(testImagePath);
        console.log('✅ ファイル入力成功！');
        
        // アップロード完了を待つ
        await page.waitForTimeout(3000);
        
        // 「次へ」ボタンを探す
        const nextButton = page.locator('button:has-text("Next"), button:has-text("次へ")').first();
        if (await nextButton.count() > 0) {
          console.log('✅ 「次へ」ボタン発見！');
          console.log('🎉 Instagram投稿フローが動作しています！');
        }
      } catch (error) {
        console.error(`❌ ファイル入力失敗: ${error.message}`);
      }
    }
  }
  
  // 全button要素
  const buttons = await dialog.locator('button').all();
  console.log(`\n🔍 button要素: ${buttons.length}個`);
  
  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const text = await buttons[i].innerText().catch(() => '');
    const ariaLabel = await buttons[i].getAttribute('aria-label');
    console.log(`  Button ${i + 1}: text="${text.substring(0, 50)}", aria-label="${ariaLabel}"`);
  }
  
  // スクリーンショット保存
  console.log('\n📸 スクリーンショット保存...');
  await page.screenshot({ path: '/tmp/instagram-modal-with-cookies.png', fullPage: true });
  console.log('  保存先: /tmp/instagram-modal-with-cookies.png');
  
  // ダイアログのHTMLを保存
  const dialogHtml = await dialog.innerHTML();
  fs.writeFileSync('/tmp/instagram-dialog.html', dialogHtml);
  console.log('  ダイアログHTML保存: /tmp/instagram-dialog.html');
  
  console.log('\n✅ デバッグ完了');
  await browser.close();
})();
