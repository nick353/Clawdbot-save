const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🔍 Instagram UI デバッグ V2 開始...');
  
  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, 'browser-profile'),
    {
      headless: true,
      viewport: { width: 1280, height: 720 }
    }
  );

  const page = browser.pages()[0] || await browser.newPage();
  
  console.log('📂 Instagram.comにアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('✅ ログイン確認完了');
  
  // 新規投稿ボタンを探す
  console.log('➕ 新規投稿ボタンを探す...');
  
  // 複数のセレクタを試す
  const selectors = [
    'a[href="#"][role="link"]:has-text("Create")',
    'a:has-text("New post")',
    'svg[aria-label="New post"]',
    '[aria-label="New post"]',
    'a[href*="create"]'
  ];
  
  let createButton = null;
  for (const selector of selectors) {
    try {
      createButton = await page.locator(selector).first();
      if (await createButton.count() > 0) {
        console.log(`✅ 新規投稿ボタン検出: ${selector}`);
        break;
      }
    } catch (e) {
      console.log(`❌ セレクタ失敗: ${selector}`);
    }
  }
  
  if (!createButton || await createButton.count() === 0) {
    console.error('❌ 新規投稿ボタンが見つかりません');
    await browser.close();
    return;
  }
  
  console.log('🖱️ クリック実行...');
  await createButton.click();
  
  // モーダルの読み込みを待つ（長めに）
  console.log('⏳ モーダルの読み込みを待機（5秒）...');
  await page.waitForTimeout(5000);
  
  // モーダル内の全体構造を確認
  console.log('\n📋 モーダル内の構造を分析...');
  
  // 1. ダイアログ/モーダルを探す
  const dialogs = await page.locator('[role="dialog"]').all();
  console.log(`🔍 ダイアログ検出: ${dialogs.length}個`);
  
  if (dialogs.length > 0) {
    const dialog = dialogs[dialogs.length - 1]; // 最後のダイアログ（最新）
    
    // ダイアログ内のテキストを確認
    const dialogText = await dialog.innerText();
    console.log('\n📝 ダイアログ内のテキスト:');
    console.log(dialogText.substring(0, 500));
    
    // ダイアログ内の全input要素
    const inputs = await dialog.locator('input').all();
    console.log(`\n🔍 ダイアログ内のinput要素: ${inputs.length}個`);
    
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const accept = await inputs[i].getAttribute('accept');
      const style = await inputs[i].getAttribute('style');
      console.log(`  Input ${i + 1}: type="${type}", accept="${accept}", style="${style}"`);
    }
    
    // ダイアログ内のボタン
    const buttons = await dialog.locator('button').all();
    console.log(`\n🔍 ダイアログ内のbutton要素: ${buttons.length}個`);
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].innerText();
      const ariaLabel = await buttons[i].getAttribute('aria-label');
      console.log(`  Button ${i + 1}: text="${text}", aria-label="${ariaLabel}"`);
    }
    
    // "Select from computer" または類似のテキストを探す
    console.log('\n🔍 "Select from computer" テキストを検索...');
    const selectTexts = await dialog.locator('text=/select from computer/i').all();
    console.log(`  見つかった数: ${selectTexts.length}個`);
    
    if (selectTexts.length > 0) {
      console.log('✅ "Select from computer" テキスト発見！');
      
      // その親要素を確認
      const parent = selectTexts[0].locator('..');
      const parentHtml = await parent.innerHTML();
      console.log('\n📋 親要素のHTML:');
      console.log(parentHtml.substring(0, 1000));
    }
    
    // SVGアイコンを探す
    console.log('\n🔍 SVGアイコンを検索...');
    const svgs = await dialog.locator('svg').all();
    console.log(`  SVG要素: ${svgs.length}個`);
    
    // クリック可能な要素を探す
    console.log('\n🔍 クリック可能な要素を検索...');
    const clickables = await dialog.locator('button, a, [role="button"]').all();
    console.log(`  クリック可能な要素: ${clickables.length}個`);
    
    for (let i = 0; i < Math.min(clickables.length, 15); i++) {
      try {
        const text = await clickables[i].innerText();
        const ariaLabel = await clickables[i].getAttribute('aria-label');
        const tagName = await clickables[i].evaluate(el => el.tagName);
        console.log(`  ${i + 1}. <${tagName}> text="${text.substring(0, 30)}", aria-label="${ariaLabel}"`);
      } catch (e) {
        console.log(`  ${i + 1}. エラー: ${e.message}`);
      }
    }
  }
  
  // 全ページ内のfile input（念のため）
  console.log('\n🔍 ページ全体のfile input要素を検索...');
  const allFileInputs = await page.locator('input[type="file"]').all();
  console.log(`  File input要素: ${allFileInputs.length}個`);
  
  for (let i = 0; i < allFileInputs.length; i++) {
    const accept = await allFileInputs[i].getAttribute('accept');
    const style = await allFileInputs[i].getAttribute('style');
    const isVisible = await allFileInputs[i].isVisible();
    console.log(`  File input ${i + 1}: accept="${accept}", visible=${isVisible}, style="${style}"`);
  }
  
  console.log('\n✅ デバッグ完了');
  
  // ブラウザを閉じない（手動確認用）
  console.log('⚠️ ブラウザを閉じずに待機中... Ctrl+Cで終了');
  await page.waitForTimeout(60000);
  
  await browser.close();
})();
