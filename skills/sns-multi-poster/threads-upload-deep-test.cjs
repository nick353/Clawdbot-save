#!/usr/bin/env node
/**
 * Threads ファイルアップロード完全解析スクリプト
 * 1. 新規投稿ボタンをクリック
 * 2. ファイル入力要素を検出
 * 3. ファイルアップロードを試みる
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';

(async () => {
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = browser.pages()[0] || await browser.newPage();

  try {
    console.log('🔄 Threadsにアクセス中...');
    await page.goto('https://www.threads.net', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('⏳ 2秒待機（ホームフィード描画待ち）...');
    await page.waitForTimeout(2000);

    // スクリーンショット1: ホームフィード
    const ss1 = `/tmp/threads-step1-home-${Date.now()}.png`;
    await page.screenshot({ path: ss1, fullPage: false });
    console.log(`📸 [1] ホームフィード: ${ss1}`);

    // 新規投稿ボタンを探す（複数のセレクタを試行）
    console.log('\n🔍 新規投稿ボタンを検索...');
    const newPostSelectors = [
      'a[href="/"]',                           // 「+」ボタン（ホームリンク）
      'a[aria-label*="New"]',                  // aria-label="New post"
      'a[aria-label*="投稿"]',                  // 日本語UI
      'svg[aria-label*="New"]',                // SVGアイコン
      '[role="link"][href="/"]',               // ロールリンク
      'a:has-text("+")',                        // 「+」テキスト
    ];

    let newPostButton = null;
    for (const selector of newPostSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          console.log(`  ✅ 発見: ${selector} (text="${text}", aria-label="${ariaLabel}")`);
          newPostButton = button;
          break;
        }
      } catch (e) {
        // セレクタエラーは無視
      }
    }

    if (!newPostButton) {
      console.log('❌ 新規投稿ボタンが見つかりません');
      
      // 左サイドバーの全リンクを確認
      console.log('\n🔍 左サイドバーの全リンクを検索...');
      const sidebarLinks = await page.$$('nav a, aside a, div[role="navigation"] a');
      console.log(`📊 サイドバーリンク数: ${sidebarLinks.length}`);
      
      for (let i = 0; i < Math.min(sidebarLinks.length, 10); i++) {
        const href = await sidebarLinks[i].getAttribute('href');
        const ariaLabel = await sidebarLinks[i].getAttribute('aria-label');
        const text = await sidebarLinks[i].textContent();
        console.log(`  [${i}] href="${href}" aria-label="${ariaLabel}" text="${text.trim()}"`);
      }
      
      await browser.close();
      return;
    }

    // 新規投稿ボタンをクリック
    console.log('\n🎯 新規投稿ボタンをクリック...');
    await newPostButton.click();
    console.log('✅ クリック完了');

    console.log('⏳ 3秒待機（投稿モーダル描画待ち）...');
    await page.waitForTimeout(3000);

    // スクリーンショット2: 投稿モーダル
    const ss2 = `/tmp/threads-step2-modal-${Date.now()}.png`;
    await page.screenshot({ path: ss2, fullPage: true });
    console.log(`📸 [2] 投稿モーダル: ${ss2}`);

    // ファイル入力要素を探す
    console.log('\n🔍 input[type="file"] を検索...');
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`📊 発見数: ${fileInputs.length}`);

    if (fileInputs.length === 0) {
      console.log('❌ ファイル入力要素が見つかりません');
      
      console.log('\n🔍 全input要素を検索...');
      const allInputs = await page.$$('input');
      console.log(`📊 input要素総数: ${allInputs.length}`);
      
      for (let i = 0; i < Math.min(allInputs.length, 20); i++) {
        const type = await allInputs[i].getAttribute('type');
        const accept = await allInputs[i].getAttribute('accept');
        const id = await allInputs[i].getAttribute('id');
        const ariaLabel = await allInputs[i].getAttribute('aria-label');
        console.log(`  [${i}] type="${type}" id="${id}" accept="${accept}" aria-label="${ariaLabel}"`);
      }

      // 画像添付ボタンを探す
      console.log('\n🔍 画像添付ボタンを検索...');
      const imageButtonSelectors = [
        'button[aria-label*="Attach"]',
        'button[aria-label*="media"]',
        'button[aria-label*="photo"]',
        'button[aria-label*="image"]',
        'button[aria-label*="添付"]',
        'button[aria-label*="画像"]',
        'svg[aria-label*="Attach"]',
        '[role="button"][aria-label*="media"]',
      ];

      for (const selector of imageButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const ariaLabel = await button.getAttribute('aria-label');
            console.log(`  ✅ 画像添付ボタン発見: ${selector} (aria-label="${ariaLabel}")`);
            
            // クリック試行
            console.log('🎯 画像添付ボタンをクリック...');
            await button.click();
            console.log('✅ クリック完了');
            
            await page.waitForTimeout(2000);
            
            // 再度ファイル入力要素を検索
            const fileInputs2 = await page.$$('input[type="file"]');
            console.log(`📊 クリック後のファイル入力要素: ${fileInputs2.length}`);
            
            if (fileInputs2.length > 0) {
              console.log('✅ ファイル入力要素が出現しました！');
              const fileInput = fileInputs2[0];
              
              const accept = await fileInput.getAttribute('accept');
              const id = await fileInput.getAttribute('id');
              const multiple = await fileInput.getAttribute('multiple');
              
              console.log(`\n📋 ファイル入力要素の詳細:`);
              console.log(`  ├─ accept: ${accept}`);
              console.log(`  ├─ id: ${id}`);
              console.log(`  └─ multiple: ${multiple}`);
              
              // テスト画像をアップロード
              const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
              if (fs.existsSync(testImage)) {
                console.log(`\n🎯 テスト画像をアップロード: ${testImage}`);
                await fileInput.setInputFiles(testImage);
                console.log('✅ ファイル設定完了');
                
                await page.waitForTimeout(2000);
                
                // スクリーンショット3: アップロード後
                const ss3 = `/tmp/threads-step3-uploaded-${Date.now()}.png`;
                await page.screenshot({ path: ss3, fullPage: true });
                console.log(`📸 [3] アップロード後: ${ss3}`);
              } else {
                console.log(`⚠️ テスト画像が見つかりません: ${testImage}`);
              }
            }
            
            break;
          }
        } catch (e) {
          // セレクタエラーは無視
        }
      }
      
      await browser.close();
      return;
    }

    // ファイル入力要素の詳細情報
    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const accept = await input.getAttribute('accept');
      const id = await input.getAttribute('id');
      const multiple = await input.getAttribute('multiple');
      const isVisible = await input.isVisible();
      
      console.log(`\n📋 ファイル入力要素 [${i}]:`);
      console.log(`  ├─ accept: ${accept}`);
      console.log(`  ├─ id: ${id}`);
      console.log(`  ├─ multiple: ${multiple}`);
      console.log(`  └─ 可視性: ${isVisible}`);
    }

    // テスト画像をアップロード
    const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
    if (fs.existsSync(testImage) && fileInputs.length > 0) {
      console.log(`\n🎯 テスト画像をアップロード: ${testImage}`);
      const fileInput = fileInputs[0];
      await fileInput.setInputFiles(testImage);
      console.log('✅ ファイル設定完了');
      
      await page.waitForTimeout(2000);
      
      // スクリーンショット3: アップロード後
      const ss3 = `/tmp/threads-step3-uploaded-${Date.now()}.png`;
      await page.screenshot({ path: ss3, fullPage: true });
      console.log(`📸 [3] アップロード後: ${ss3}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
