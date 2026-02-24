#!/usr/bin/env node
/**
 * Threads ファイルアップロード完全解析スクリプト v3
 * 正しい認証方法でログイン → 新規投稿 → ファイルアップロード
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

(async () => {
  console.log('🧵 Threads ファイルアップロードテスト v3\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    let context;

    // ブラウザプロファイルが存在するか確認
    if (fs.existsSync(STATE_PATH) && fs.existsSync(COOKIES_PATH)) {
      console.log('📂 ブラウザプロファイルを使用します');

      context = await browser.newContext({
        storageState: STATE_PATH,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      });

      // クッキーも追加（フォールバック）
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
      await context.addCookies(cookies);
      console.log(`✅ Cookie数: ${cookies.length}\n`);
    } else {
      console.error('❌ ブラウザプロファイルが見つかりません');
      console.error('   初期化スクリプトを実行してください:');
      console.error('   bash /root/clawd/scripts/threads-browser-profile-init.cjs');
      process.exit(1);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    console.log('🔄 Threadsにアクセス中...');
    await page.goto('https://www.threads.net', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('⏳ 2秒待機（ホームフィード描画待ち）...');
    await page.waitForTimeout(2000);

    // スクリーンショット1: ホームフィード
    const ss1 = `/tmp/threads-v3-step1-home-${Date.now()}.png`;
    await page.screenshot({ path: ss1, fullPage: false });
    console.log(`📸 [1] ホームフィード: ${ss1}`);

    // ログイン確認
    const signupModal = await page.$('text=Sign up to post');
    if (signupModal) {
      console.error('\n❌ ログインしていません！');
      console.error('   Cookie が期限切れの可能性があります。');
      console.error('   再ログインしてください:');
      console.error('   bash /root/clawd/scripts/threads-browser-profile-init.cjs');
      await browser.close();
      process.exit(1);
    }

    // 新規投稿ボタンを探す
    console.log('\n🔍 新規投稿ボタンを検索...');
    const allButtons = await page.$$('button, a[role="button"], div[role="button"]');
    console.log(`📊 ボタン要素総数: ${allButtons.length}`);

    let createButton = null;
    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].textContent();
      const textLower = text?.toLowerCase();

      if (
        textLower?.includes('create') ||
        textLower?.includes('new') ||
        textLower?.includes('write') ||
        text?.trim() === '+'
      ) {
        console.log(`✅ 新規投稿ボタン発見: text="${text?.trim()}"`);
        createButton = allButtons[i];
        break;
      }
    }

    if (!createButton) {
      console.error('❌ 新規投稿ボタンが見つかりません');
      await browser.close();
      process.exit(1);
    }

    // 新規投稿ボタンをクリック
    console.log('\n🎯 新規投稿ボタンをクリック...');
    await createButton.click();
    console.log('✅ クリック完了');

    console.log('⏳ 3秒待機（投稿モーダル描画待ち）...');
    await page.waitForTimeout(3000);

    // スクリーンショット2: 投稿モーダル
    const ss2 = `/tmp/threads-v3-step2-modal-${Date.now()}.png`;
    await page.screenshot({ path: ss2, fullPage: true });
    console.log(`📸 [2] 投稿モーダル: ${ss2}`);

    // ファイル入力要素を探す
    console.log('\n🔍 input[type="file"] を検索...');
    let fileInputs = await page.$$('input[type="file"]');
    console.log(`📊 発見数: ${fileInputs.length}`);

    if (fileInputs.length === 0) {
      console.log('⚠️  ファイル入力要素が見つかりません');
      console.log('🔍 画像添付ボタンを探してクリックしてみます...');

      // 画像添付ボタンを探す
      const imageButtonSelectors = [
        'button[aria-label*="Attach"]',
        'button[aria-label*="media"]',
        'button[aria-label*="photo"]',
        'button[aria-label*="image"]',
        'svg[aria-label*="Attach"]',
        '[role="button"]:has(svg)',
      ];

      for (const selector of imageButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const ariaLabel = await button.getAttribute('aria-label');
            console.log(`  ✅ 画像添付ボタン発見: ${selector} (aria-label="${ariaLabel}")`);

            console.log('🎯 画像添付ボタンをクリック...');
            await button.click();
            console.log('✅ クリック完了');

            await page.waitForTimeout(2000);

            // 再度ファイル入力要素を検索
            fileInputs = await page.$$('input[type="file"]');
            console.log(`📊 クリック後のファイル入力要素: ${fileInputs.length}`);

            if (fileInputs.length > 0) {
              break;
            }
          }
        } catch (e) {
          // セレクタエラーは無視
        }
      }
    }

    if (fileInputs.length === 0) {
      console.error('❌ ファイル入力要素が見つかりませんでした');

      // 全input要素を確認
      console.log('\n🔍 全input要素を確認...');
      const allInputs = await page.$$('input');
      console.log(`📊 input要素総数: ${allInputs.length}`);

      for (let i = 0; i < Math.min(allInputs.length, 10); i++) {
        const type = await allInputs[i].getAttribute('type');
        const accept = await allInputs[i].getAttribute('accept');
        const id = await allInputs[i].getAttribute('id');
        const ariaLabel = await allInputs[i].getAttribute('aria-label');
        console.log(`  [${i}] type="${type}" id="${id}" accept="${accept}" aria-label="${ariaLabel}"`);
      }

      await browser.close();
      process.exit(1);
    }

    // ファイル入力要素の詳細情報
    console.log('\n📋 ファイル入力要素の詳細:');
    const fileInput = fileInputs[0];
    const accept = await fileInput.getAttribute('accept');
    const id = await fileInput.getAttribute('id');
    const multiple = await fileInput.getAttribute('multiple');

    console.log(`  ├─ accept: ${accept}`);
    console.log(`  ├─ id: ${id}`);
    console.log(`  └─ multiple: ${multiple}`);

    // テスト画像をアップロード
    const testImage = '/root/clawd/skills/sns-multi-poster/test-image.jpg';
    if (fs.existsSync(testImage)) {
      console.log(`\n🎯 テスト画像をアップロード: ${testImage}`);
      await fileInput.setInputFiles(testImage);
      console.log('✅ ファイル設定完了');

      await page.waitForTimeout(3000);

      // スクリーンショット3: アップロード後
      const ss3 = `/tmp/threads-v3-step3-uploaded-${Date.now()}.png`;
      await page.screenshot({ path: ss3, fullPage: true });
      console.log(`📸 [3] アップロード後: ${ss3}`);

      console.log('\n🎉 ファイルアップロードに成功しました！');
    } else {
      console.error(`⚠️ テスト画像が見つかりません: ${testImage}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
