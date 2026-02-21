const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🔍 Instagram UI 詳細デバッグ（URL変化追跡）');
  
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
  
  // URL変化を監視
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`🔄 ページ遷移: ${frame.url()}`);
    }
  });
  
  console.log('📂 Instagram.comにアクセス...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log(`✅ 現在のURL: ${page.url()}`);
  
  // 新規投稿ボタンを探す
  console.log('\n🔍 "New post" SVGを探す...');
  const createSvg = await page.locator('svg[aria-label="New post"]').first();
  
  if (await createSvg.count() === 0) {
    console.error('❌ "New post" SVGが見つかりません');
    await browser.close();
    return;
  }
  
  console.log('✅ "New post" SVG発見');
  
  // 親要素を探す
  const parentLink = createSvg.locator('xpath=ancestor::a').first();
  
  if (await parentLink.count() === 0) {
    console.error('❌ 親<a>要素が見つかりません');
    await browser.close();
    return;
  }
  
  console.log('✅ 親<a>要素発見');
  
  // hrefを確認
  const href = await parentLink.getAttribute('href');
  console.log(`  href: "${href}"`);
  
  // クリック前のURL
  console.log(`\n📍 クリック前のURL: ${page.url()}`);
  
  // クリック実行
  console.log('🖱️ クリック実行...');
  await parentLink.click();
  
  // クリック後のURL変化を待つ
  console.log('⏳ URL変化を待機（2秒）...');
  await page.waitForTimeout(2000);
  
  console.log(`📍 クリック後のURL: ${page.url()}`);
  
  // モーダルまたはページ変化を待つ（15秒）
  console.log('⏳ モーダル/ページ読み込みを待機（15秒）...');
  await page.waitForTimeout(15000);
  
  console.log(`📍 15秒後のURL: ${page.url()}`);
  
  // 全ての role を持つ要素を確認
  console.log('\n📋 全ての role 属性を持つ要素:');
  const allRoles = await page.locator('[role]').all();
  const roleMap = new Map();
  
  for (const element of allRoles) {
    const role = await element.getAttribute('role');
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  }
  
  console.log('  検出されたrole:');
  for (const [role, count] of roleMap.entries()) {
    console.log(`    ${role}: ${count}個`);
  }
  
  // ダイアログを探す
  const dialogs = await page.locator('[role="dialog"]').all();
  console.log(`\n🔍 [role="dialog"]: ${dialogs.length}個`);
  
  // 別のモーダルセレクタを試す
  const modals = await page.locator('div[class*="modal"], div[class*="Modal"]').all();
  console.log(`🔍 div[class*="modal"]: ${modals.length}個`);
  
  // aria-modal属性を持つ要素
  const ariaModals = await page.locator('[aria-modal="true"]').all();
  console.log(`🔍 [aria-modal="true"]: ${ariaModals.length}個`);
  
  // 固定位置要素（モーダルは通常fixed）
  const fixedElements = await page.locator('div[style*="position: fixed"], div[style*="position:fixed"]').all();
  console.log(`🔍 position:fixed: ${fixedElements.length}個`);
  
  // z-indexが高い要素（モーダルは通常高いz-index）
  const highZindex = await page.locator('div[style*="z-index"]').all();
  console.log(`🔍 z-indexあり: ${highZindex.length}個`);
  
  // ページ全体のfile input
  console.log('\n🔍 ページ全体のfile input:');
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`  File input数: ${fileInputs.length}個`);
  
  for (let i = 0; i < fileInputs.length; i++) {
    const accept = await fileInputs[i].getAttribute('accept');
    const isVisible = await fileInputs[i].isVisible();
    const isHidden = await fileInputs[i].isHidden();
    const boundingBox = await fileInputs[i].boundingBox();
    console.log(`  ${i + 1}. accept="${accept}", visible=${isVisible}, hidden=${isHidden}`);
    if (boundingBox) {
      console.log(`      位置: x=${boundingBox.x}, y=${boundingBox.y}, w=${boundingBox.width}, h=${boundingBox.height}`);
    }
  }
  
  // HTMLを保存
  const html = await page.content();
  fs.writeFileSync('/tmp/instagram-after-click.html', html);
  console.log('\n💾 HTML保存: /tmp/instagram-after-click.html');
  
  // スクリーンショット
  await page.screenshot({ path: '/tmp/instagram-detailed-debug.png', fullPage: true });
  console.log('📸 スクリーンショット: /tmp/instagram-detailed-debug.png');
  
  console.log('\n✅ デバッグ完了');
  await browser.close();
})();
