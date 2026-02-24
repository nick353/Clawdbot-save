const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ],
    executablePath: '/usr/bin/chromium-browser',
    userDataDir: '/root/.config/chromium/instagram-profile'
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  console.log('📱 Instagram にアクセス中...');
  await page.goto('https://www.instagram.com/', { 
    waitUntil: 'domcontentloaded',
    timeout: 15000 
  });
  
  await new Promise(r => setTimeout(r, 3000));

  console.log('🔍 新規投稿ボタンを探しています...');
  
  // パターン1: サイドバーの + アイコン
  const createSelectors = [
    'a[href="#"][role="link"]', // + アイコン
    'a[aria-label*="Create"]',
    'a[aria-label*="新規"]',
    'svg[aria-label="New post"]',
    'svg[aria-label="新しい投稿"]',
    'div[role="menuitem"]:has-text("Create")',
    'span:has-text("Create")',
    'span:has-text("新規投稿")'
  ];

  let createButton = null;
  for (const selector of createSelectors) {
    try {
      createButton = await page.$(selector);
      if (createButton) {
        console.log(`✅ 見つかりました: ${selector}`);
        break;
      }
    } catch (e) {
      // continue
    }
  }

  if (!createButton) {
    console.log('⚠️ 通常の方法で見つからないので、全リンクを調査...');
    const allLinks = await page.$$('a[role="link"]');
    console.log(`全リンク数: ${allLinks.length}`);
    
    for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
      const link = allLinks[i];
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), link);
      const href = await page.evaluate(el => el.getAttribute('href'), link);
      const text = await page.evaluate(el => el.textContent, link);
      console.log(`[${i}] aria-label="${ariaLabel}" href="${href}" text="${text}"`);
      
      // Create や 新規 を含むリンクを探す
      if (
        (ariaLabel && (ariaLabel.includes('Create') || ariaLabel.includes('新規'))) ||
        (text && (text.includes('Create') || text.includes('新規')))
      ) {
        createButton = link;
        console.log(`✅ 新規投稿ボタンを発見: index ${i}`);
        break;
      }
    }
  }

  if (createButton) {
    console.log('🖱️ 新規投稿ボタンをクリック...');
    await createButton.click();
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('📸 スクリーンショット撮影...');
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-create-clicked.png', fullPage: true });
    
    console.log('🔍 ファイル入力要素を探しています...');
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`ファイル入力総数: ${fileInputs.length}`);
    
    if (fileInputs.length > 0) {
      console.log('✅ ファイル入力要素が見つかりました！');
    } else {
      console.log('⚠️ まだファイル入力要素が見つかりません。HTMLを保存...');
      const html = await page.content();
      require('fs').writeFileSync('/tmp/sns-ui-debug/instagram-create-clicked.html', html);
    }
  } else {
    console.log('❌ 新規投稿ボタンが見つかりませんでした');
    await page.screenshot({ path: '/tmp/sns-ui-debug/instagram-no-create-button.png', fullPage: true });
  }

  console.log('=========================================');
  console.log('✅ 完了');
  console.log('=========================================');
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
