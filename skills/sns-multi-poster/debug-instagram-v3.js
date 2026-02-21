const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('🔍 Instagram UI デバッグ V3 開始...');
  
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
  await page.waitForTimeout(3000);
  
  console.log('✅ ログイン確認完了');
  
  // ページ全体のリンクとボタンを調査
  console.log('\n📋 全てのリンク（Create/New含む）:');
  const allLinks = await page.locator('a').all();
  console.log(`  総リンク数: ${allLinks.length}個`);
  
  for (let i = 0; i < allLinks.length; i++) {
    try {
      const text = await allLinks[i].innerText();
      const href = await allLinks[i].getAttribute('href');
      const ariaLabel = await allLinks[i].getAttribute('aria-label');
      
      // "Create", "New", "Post"を含むものだけ表示
      if (text.toLowerCase().includes('create') || 
          text.toLowerCase().includes('new') || 
          text.toLowerCase().includes('post') ||
          (ariaLabel && (ariaLabel.toLowerCase().includes('create') || 
                         ariaLabel.toLowerCase().includes('new')))) {
        console.log(`  ${i + 1}. text="${text}", href="${href}", aria-label="${ariaLabel}"`);
      }
    } catch (e) {
      // スキップ
    }
  }
  
  console.log('\n📋 全てのSVG（aria-label含む）:');
  const allSvgs = await page.locator('svg[aria-label]').all();
  console.log(`  総SVG数: ${allSvgs.length}個`);
  
  for (let i = 0; i < Math.min(allSvgs.length, 20); i++) {
    const ariaLabel = await allSvgs[i].getAttribute('aria-label');
    console.log(`  ${i + 1}. aria-label="${ariaLabel}"`);
  }
  
  // "Create"または"New post"を含むaria-labelを探す
  console.log('\n🔍 "Create" または "New" を含むSVGを探す...');
  const createSvg = await page.locator('svg[aria-label*="Create"], svg[aria-label*="New"]').first();
  
  if (await createSvg.count() > 0) {
    console.log('✅ Create SVG発見！');
    const ariaLabel = await createSvg.getAttribute('aria-label');
    console.log(`  aria-label: "${ariaLabel}"`);
    
    // 親要素を探す（クリック可能な要素）
    const parent = createSvg.locator('xpath=ancestor::a | ancestor::button').first();
    if (await parent.count() > 0) {
      console.log('✅ クリック可能な親要素発見！');
      const tagName = await parent.evaluate(el => el.tagName);
      const href = await parent.getAttribute('href');
      console.log(`  タグ: <${tagName}>, href="${href}"`);
      
      // クリック実行
      console.log('🖱️ クリック実行...');
      await parent.click();
      
      // モーダルの読み込みを待つ
      console.log('⏳ モーダルの読み込みを待機（8秒）...');
      await page.waitForTimeout(8000);
      
      // ダイアログを探す
      console.log('\n📋 ダイアログを検索...');
      const dialogs = await page.locator('[role="dialog"]').all();
      console.log(`  ダイアログ数: ${dialogs.length}個`);
      
      if (dialogs.length > 0) {
        const dialog = dialogs[dialogs.length - 1];
        
        // ダイアログ内のテキスト
        const dialogText = await dialog.innerText();
        console.log('\n📝 ダイアログ内のテキスト:');
        console.log(dialogText.substring(0, 1000));
        
        // 全input要素
        const inputs = await dialog.locator('input').all();
        console.log(`\n🔍 input要素: ${inputs.length}個`);
        
        for (let i = 0; i < inputs.length; i++) {
          const type = await inputs[i].getAttribute('type');
          const accept = await inputs[i].getAttribute('accept');
          const isVisible = await inputs[i].isVisible();
          const style = await inputs[i].getAttribute('style');
          console.log(`  Input ${i + 1}: type="${type}", accept="${accept}", visible=${isVisible}`);
          if (style) {
            console.log(`    style="${style.substring(0, 200)}"`);
          }
        }
        
        // 全button要素
        const buttons = await dialog.locator('button').all();
        console.log(`\n🔍 button要素: ${buttons.length}個`);
        
        for (let i = 0; i < Math.min(buttons.length, 15); i++) {
          const text = await buttons[i].innerText();
          const ariaLabel = await buttons[i].getAttribute('aria-label');
          console.log(`  Button ${i + 1}: text="${text.substring(0, 50)}", aria-label="${ariaLabel}"`);
        }
        
        // "Select from computer" テキストを探す
        console.log('\n🔍 "Select" または "computer" を含むテキストを検索...');
        const selectButtons = await dialog.locator('button:has-text("Select"), button:has-text("computer"), button:has-text("from"), span:has-text("Select")').all();
        console.log(`  見つかった数: ${selectButtons.length}個`);
        
        for (let i = 0; i < selectButtons.length; i++) {
          const text = await selectButtons[i].innerText();
          console.log(`  ${i + 1}. text="${text}"`);
        }
        
        // ページ全体のfile input
        console.log('\n🔍 ページ全体のfile input:');
        const fileInputs = await page.locator('input[type="file"]').all();
        console.log(`  File input数: ${fileInputs.length}個`);
        
        for (let i = 0; i < fileInputs.length; i++) {
          const accept = await fileInputs[i].getAttribute('accept');
          const isVisible = await fileInputs[i].isVisible();
          console.log(`  File input ${i + 1}: accept="${accept}", visible=${isVisible}`);
        }
        
        // スクリーンショット保存
        console.log('\n📸 スクリーンショット保存...');
        await page.screenshot({ path: '/tmp/instagram-modal-debug.png', fullPage: true });
        console.log('  保存先: /tmp/instagram-modal-debug.png');
      } else {
        console.error('❌ ダイアログが見つかりません');
      }
    } else {
      console.error('❌ クリック可能な親要素が見つかりません');
    }
  } else {
    console.error('❌ Create SVGが見つかりません');
  }
  
  console.log('\n✅ デバッグ完了');
  await browser.close();
})();
