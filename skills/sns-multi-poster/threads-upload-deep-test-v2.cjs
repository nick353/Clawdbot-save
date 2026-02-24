#!/usr/bin/env node
/**
 * Threads ファイルアップロード完全解析スクリプト v2
 * サイドバーの全要素を確認して「+」ボタンを特定
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
    const ss1 = `/tmp/threads-v2-step1-home-${Date.now()}.png`;
    await page.screenshot({ path: ss1, fullPage: false });
    console.log(`📸 [1] ホームフィード: ${ss1}`);

    // サイドバーの全要素を確認
    console.log('\n🔍 サイドバーの全要素を確認...');
    
    // 方法1: 全てのボタンを確認
    const allButtons = await page.$$('button, a[role="button"], div[role="button"]');
    console.log(`📊 ボタン要素総数: ${allButtons.length}`);
    
    for (let i = 0; i < Math.min(allButtons.length, 30); i++) {
      const ariaLabel = await allButtons[i].getAttribute('aria-label');
      const text = await allButtons[i].textContent();
      const role = await allButtons[i].getAttribute('role');
      const href = await allButtons[i].getAttribute('href');
      
      console.log(`  [${i}] role="${role}" href="${href}" aria-label="${ariaLabel}" text="${text?.trim()}"`);
      
      // 「+」や「New」「Create」「Write」などのキーワードを含むボタンを探す
      const textLower = text?.toLowerCase();
      const ariaLower = ariaLabel?.toLowerCase();
      
      if (
        ariaLower?.includes('new') ||
        ariaLower?.includes('create') ||
        ariaLower?.includes('write') ||
        ariaLower?.includes('post') ||
        ariaLower?.includes('compose') ||
        textLower?.includes('create') ||
        textLower?.includes('new') ||
        textLower?.includes('write') ||
        text?.trim() === '+' ||
        text?.trim() === '新規'
      ) {
        console.log(`\n✅ 新規投稿ボタン候補発見: [${i}]`);
        console.log(`   aria-label: ${ariaLabel}`);
        console.log(`   text: ${text?.trim()}`);
        
        // クリック試行
        console.log('\n🎯 このボタンをクリックしてみます...');
        try {
          await allButtons[i].click();
          console.log('✅ クリック完了');
          
          console.log('⏳ 3秒待機（投稿モーダル描画待ち）...');
          await page.waitForTimeout(3000);
          
          // スクリーンショット2: クリック後
          const ss2 = `/tmp/threads-v2-step2-after-click-${Date.now()}.png`;
          await page.screenshot({ path: ss2, fullPage: true });
          console.log(`📸 [2] クリック後: ${ss2}`);
          
          // input要素を確認
          const fileInputs = await page.$$('input[type="file"]');
          const allInputs = await page.$$('input');
          console.log(`\n📊 クリック後の input[type="file"]: ${fileInputs.length}`);
          console.log(`📊 クリック後の input総数: ${allInputs.length}`);
          
          if (fileInputs.length > 0) {
            console.log('✅ ファイル入力要素が出現！');
            const fileInput = fileInputs[0];
            
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
              const ss3 = `/tmp/threads-v2-step3-uploaded-${Date.now()}.png`;
              await page.screenshot({ path: ss3, fullPage: true });
              console.log(`📸 [3] アップロード後: ${ss3}`);
            }
          } else if (allInputs.length > 0) {
            console.log('\n📋 全input要素を確認:');
            for (let j = 0; j < Math.min(allInputs.length, 10); j++) {
              const type = await allInputs[j].getAttribute('type');
              const accept = await allInputs[j].getAttribute('accept');
              const id = await allInputs[j].getAttribute('id');
              const ariaLabel = await allInputs[j].getAttribute('aria-label');
              const placeholder = await allInputs[j].getAttribute('placeholder');
              console.log(`    [${j}] type="${type}" id="${id}" accept="${accept}" aria-label="${ariaLabel}" placeholder="${placeholder}"`);
            }
          }
          
          // 1つ見つかったら終了
          break;
          
        } catch (clickError) {
          console.error(`❌ クリックエラー: ${clickError.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
