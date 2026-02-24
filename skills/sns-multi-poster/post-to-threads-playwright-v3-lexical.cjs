#!/usr/bin/env node
/**
 * Threads 投稿スクリプト v3 (Lexicalエディタ対応)
 * HTML分析結果を元に、Lexicalエディタに正しく入力
 * 
 * Usage: node post-to-threads-playwright-v3-lexical.cjs <text> [image_path]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , text, imagePath] = process.argv;

if (!text) {
  console.error('使い方: node post-to-threads-playwright-v3-lexical.cjs <text> [image_path]');
  process.exit(1);
}

if (imagePath && !fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🧵 Threads 投稿スクリプト v3 (Lexicalエディタ対応)\n');

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
    if (!fs.existsSync(STATE_PATH) || !fs.existsSync(COOKIES_PATH)) {
      console.error('❌ ブラウザプロファイルが見つかりません');
      console.error('   初期化: bash /root/clawd/scripts/threads-browser-profile-init.cjs');
      process.exit(1);
    }

    const context = await browser.newContext({
      storageState: STATE_PATH,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);
    console.log(`✅ Cookie数: ${cookies.length}\n`);

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Threadsにアクセス
    console.log('🌐 Threads にアクセス中...');
    await page.goto('https://www.threads.net', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    // ログイン確認
    const signupModal = await page.$('text=Sign up to post');
    if (signupModal) {
      console.error('\n❌ ログインしていません！');
      console.error('   再ログイン: bash /root/clawd/scripts/threads-browser-profile-init.cjs');
      await browser.close();
      process.exit(1);
    }

    // Createボタンを探す
    console.log('\n🔍 Createボタンを検索中...');
    const allButtons = await page.$$('button, a[role="button"], div[role="button"]');
    
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
        console.log(`✅ Createボタン発見: "${text?.trim()}"`);
        createButton = allButtons[i];
        break;
      }
    }

    if (!createButton) {
      console.error('❌ Createボタンが見つかりません');
      await browser.close();
      process.exit(1);
    }

    // Createボタンをクリック
    console.log('\n🎯 Createボタンをクリック...');
    await createButton.click();
    
    console.log('⏳ 投稿モーダルの出現を待機...');
    await page.waitForSelector('div[role="dialog"]', { 
      state: 'attached', // visible ではなく attached で待機
      timeout: 10000      // タイムアウト延長: 5秒 → 10秒
    });
    console.log('✅ モーダル発見');

    await page.waitForTimeout(3000); // モーダル表示待機: 2秒 → 3秒

    // Lexicalエディタを取得（複数セレクタを試行）
    console.log('\n✍️  Lexicalエディタに入力中...');
    
    const editorSelectors = [
      'div[data-lexical-editor="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'div[aria-label*="write" i]',
      'div[aria-label*="text" i]'
    ];
    
    let lexicalEditor = null;
    for (const selector of editorSelectors) {
      try {
        lexicalEditor = await page.$(selector);
        if (lexicalEditor) {
          console.log(`✅ Lexicalエディタ発見: ${selector}`);
          break;
        }
      } catch (e) {
        // セレクタエラーは無視
      }
    }
    
    if (!lexicalEditor) {
      console.error('❌ Lexicalエディタが見つかりません（全セレクタ失敗）');
      await browser.close();
      process.exit(1);
    }

    // Lexicalエディタにフォーカスして、page.keyboard.type() で入力
    await lexicalEditor.click();
    await page.waitForTimeout(500);
    
    // キーボードで直接入力（最も確実な方法）
    await page.keyboard.type(text, { delay: 30 });
    
    console.log('  ✅ キーボード入力完了');

    console.log(`✅ テキスト入力完了: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    await page.waitForTimeout(1000);

    // 画像がある場合はアップロード
    if (imagePath) {
      console.log('\n📸 画像をアップロード中...');

      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) {
        console.error('❌ ファイル入力要素が見つかりません');
        await browser.close();
        process.exit(1);
      }

      await fileInput.setInputFiles(path.resolve(imagePath));
      console.log('✅ ファイルアップロード完了');

      await page.waitForTimeout(3000);
    }

    // 投稿（Ctrl+Enter ショートカットを使用）
    console.log('\n🚀 投稿中（Ctrl+Enter）...');
    
    // Lexicalエディタにフォーカスを確保
    await lexicalEditor.click();
    await page.waitForTimeout(500);
    
    // Ctrl+Enter で投稿
    await page.keyboard.press('Control+Enter');
    console.log('✅ 投稿ショートカット実行完了');

    // 投稿完了を待機（短縮: 3秒 → 1秒）
    await page.waitForTimeout(1000);

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
