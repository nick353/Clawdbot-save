const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, 'browser-profile'),
    { headless: true }
  );

  try {
    const page = browser.pages()[0];
    console.log('📂 Instagram にアクセス...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // ページのHTMLを一部保存
    const html = await page.content();
    fs.writeFileSync('/tmp/instagram-debug.html', html);
    console.log('✓ HTML保存: /tmp/instagram-debug.html');
    
    // input フィールドを全て検出
    const inputs = await page.locator('input').all();
    console.log(`\n検出されたinput要素: ${inputs.length}個`);
    
    for (let i = 0; i < inputs.length && i < 5; i++) {
      const attr = await inputs[i].getAttribute('name');
      const type = await inputs[i].getAttribute('type');
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log(`  [${i}] name="${attr}" type="${type}" placeholder="${placeholder}"`);
    }
    
    // ページのテキスト内容
    const text = await page.innerText('body');
    const hasLoginForm = text.includes('Log in') || text.includes('ログイン');
    const hasHome = text.includes('Home');
    
    console.log(`\nページ内容判定:`);
    console.log(`  - ログインフォーム: ${hasLoginForm ? '✓' : '✗'}`);
    console.log(`  - ホーム画面: ${hasHome ? '✓' : '✗'}`);
    
    // ボタン要素を検出
    const buttons = await page.locator('button').all();
    console.log(`\nボタン要素: ${buttons.length}個`);
    for (let i = 0; i < buttons.length && i < 3; i++) {
      const text = await buttons[i].innerText();
      console.log(`  [${i}] "${text}"`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
