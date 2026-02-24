#!/usr/bin/env node
/**
 * Threads ファイルアップロード要素探索スクリプト
 * 既存のブラウザプロファイルを使用してファイル入力要素を探す
 */

const { chromium } = require('playwright');
const path = require('path');

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

    console.log('⏳ 3秒待機（画像添付ボタンの描画待ち）...');
    await page.waitForTimeout(3000);

    // スクリーンショット
    const screenshotPath = `/tmp/threads-upload-finder-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 スクリーンショット: ${screenshotPath}`);

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
      
      await browser.close();
      return;
    }

    // 各ファイル入力要素の詳細情報
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

      // 親要素を確認
      const parent = await input.evaluateHandle(el => el.parentElement);
      const parentTag = await parent.evaluate(el => el.tagName);
      const parentClass = await parent.evaluate(el => el.className);
      const parentAriaLabel = await parent.evaluate(el => el.getAttribute('aria-label'));
      
      console.log(`  親要素:`);
      console.log(`    ├─ タグ: ${parentTag}`);
      console.log(`    ├─ class: ${parentClass}`);
      console.log(`    └─ aria-label: ${parentAriaLabel}`);
    }

    // クリック試行
    if (fileInputs.length > 0) {
      console.log('\n🎯 最初のファイル入力要素をクリック試行...');
      const fileInput = fileInputs[0];
      
      try {
        // 可視性チェック
        const isVisible = await fileInput.isVisible();
        if (!isVisible) {
          console.log('⚠️ 要素が非表示です。親要素経由でクリックを試みます...');
          const parent = await fileInput.evaluateHandle(el => el.parentElement);
          await parent.click();
        } else {
          await fileInput.click();
        }
        
        console.log('✅ クリック完了');
        await page.waitForTimeout(2000);
        console.log('✅ 待機完了');
        
        // クリック後のスクリーンショット
        const afterScreenshot = `/tmp/threads-upload-after-${Date.now()}.png`;
        await page.screenshot({ path: afterScreenshot, fullPage: true });
        console.log(`📸 クリック後: ${afterScreenshot}`);
        
      } catch (clickError) {
        console.error('❌ クリックエラー:', clickError.message);
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
