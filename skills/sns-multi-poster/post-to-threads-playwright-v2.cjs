#!/usr/bin/env node
/**
 * Threads 投稿スクリプト (Playwright ブラウザプロファイル版 v2)
 * 2026-02-24 調査結果を反映:
 * - Createボタンを正しく検出
 * - 新規投稿モーダルを開いてからファイル入力要素を検索
 * - 画像アップロード動作確認済み
 *
 * Usage: node post-to-threads-playwright-v2.cjs <text> [image_path]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , text, imagePath] = process.argv;

if (!text) {
  console.error('使い方: node post-to-threads-playwright-v2.cjs <text> [image_path]');
  process.exit(1);
}

if (imagePath && !fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// ブラウザプロファイルディレクトリ
const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🧵 Threads 投稿スクリプト v2\n');

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

    // Threads にアクセス
    console.log('🌐 Threads にアクセス中...');
    await page.goto('https://www.threads.net', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('⏳ 2秒待機（ホームフィード描画待ち）...');
    await page.waitForTimeout(2000);

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

    // 新規投稿ボタン (Create) を探す
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

    console.log('⏳ 投稿モーダルの出現を待機...');
    
    // モーダルが開くのを待つ（複数セレクタを試行）
    const modalSelectors = [
      'div[role="dialog"]',
      '[aria-label*="New thread"]',
      'div:has-text("New thread")',
    ];

    let modalFound = false;
    for (const selector of modalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✅ モーダル発見: ${selector}`);
        modalFound = true;
        break;
      } catch (e) {
        // タイムアウト時は次のセレクタを試行
      }
    }

    if (!modalFound) {
      console.error('❌ 投稿モーダルが開きませんでした');
      
      // デバッグ用スクリーンショット
      const ssError = `/tmp/threads-v2-error-${Date.now()}.png`;
      await page.screenshot({ path: ssError, fullPage: true });
      console.error(`📸 エラー時のスクリーンショット: ${ssError}`);
      
      await browser.close();
      process.exit(1);
    }

    await page.waitForTimeout(1000);

    // スクリーンショット: 投稿モーダル
    const ss1 = `/tmp/threads-v2-modal-${Date.now()}.png`;
    await page.screenshot({ path: ss1, fullPage: true });
    console.log(`📸 投稿モーダル: ${ss1}`);

    // テキストを入力
    console.log('\n✍️  テキストを入力中...');
    
    // 複数のセレクタを試行
    const textInputSelectors = [
      'div[contenteditable="true"]',
      'textarea',
      'div[aria-label*="What"]',
      'div[role="textbox"]',
      '[contenteditable="true"]',
    ];

    let textInput = null;
    for (const selector of textInputSelectors) {
      textInput = await page.$(selector);
      if (textInput) {
        console.log(`✅ テキスト入力欄発見: ${selector}`);
        break;
      }
    }

    if (!textInput) {
      console.error('❌ テキスト入力欄が見つかりません');
      
      // デバッグ: 全contenteditable要素を確認
      const allContentEditable = await page.$$('[contenteditable]');
      console.log(`📊 contenteditable要素総数: ${allContentEditable.length}`);
      
      for (let i = 0; i < Math.min(allContentEditable.length, 5); i++) {
        const ariaLabel = await allContentEditable[i].getAttribute('aria-label');
        const role = await allContentEditable[i].getAttribute('role');
        const text = await allContentEditable[i].textContent();
        console.log(`  [${i}] role="${role}" aria-label="${ariaLabel}" text="${text?.trim()}"`);
      }
      
      await browser.close();
      process.exit(1);
    }

    await textInput.click();
    await page.waitForTimeout(500);
    
    // フォーカスしてから page.keyboard で直接入力（最も確実）
    await textInput.focus();
    await page.waitForTimeout(300);
    await page.keyboard.type(text, { delay: 30 });
    
    console.log(`✅ テキスト入力完了: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    await page.waitForTimeout(1000); // テキスト入力後の処理待ち

    // 画像がある場合はアップロード
    if (imagePath) {
      console.log('\n📸 画像をアップロード中...');

      // ファイル入力要素を探す
      let fileInputs = await page.$$('input[type="file"]');
      console.log(`📊 ファイル入力要素: ${fileInputs.length}`);

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
        await browser.close();
        process.exit(1);
      }

      // ファイルアップロード
      const fileInput = fileInputs[0];
      const accept = await fileInput.getAttribute('accept');
      console.log(`📋 accept: ${accept}`);

      await fileInput.setInputFiles(path.resolve(imagePath));
      console.log('✅ ファイルアップロード完了');

      await page.waitForTimeout(3000);
    }

    // 投稿ボタンをクリック
    console.log('\n⏳ 投稿ボタンを検索中...');
    const postButton = await page.$('button:has-text("Post")');
    if (!postButton) {
      console.error('❌ 投稿ボタンが見つかりません');
      await browser.close();
      process.exit(1);
    }

    console.log('🚀 投稿中...');
    await postButton.click();
    console.log('✅ 投稿ボタンをクリック完了');

    // 投稿完了を待機
    await page.waitForTimeout(3000);

    // プロファイルを保存（セッション更新用）
    console.log('\n💾 セッションを保存中...');
    const newState = await context.storageState();
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(newState, null, 2));

    const newCookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(newCookies, null, 2));
    console.log('✅ セッション保存完了');

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Threads 投稿が完了しました！');
    console.log('='.repeat(50));

    await context.close();
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
