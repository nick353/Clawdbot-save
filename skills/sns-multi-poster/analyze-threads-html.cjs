#!/usr/bin/env node
/**
 * Threads HTML構造分析スクリプト
 * 投稿モーダルが開いた状態のHTML構造を完全にダンプして分析
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/threads';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🔍 Threads HTML構造分析\n');

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
      process.exit(1);
    }

    const context = await browser.newContext({
      storageState: STATE_PATH,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Threadsにアクセス
    console.log('🌐 Threads にアクセス中...');
    await page.goto('https://www.threads.net', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

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
    await page.waitForTimeout(3000);

    // モーダルが開いているか確認
    const modal = await page.$('div[role="dialog"]');
    if (!modal) {
      console.error('❌ モーダルが開きませんでした');
      await browser.close();
      process.exit(1);
    }

    console.log('✅ モーダルが開きました\n');
    console.log('='.repeat(80));
    console.log('HTML構造分析開始');
    console.log('='.repeat(80));

    // 1. すべてのinput要素を分析
    console.log('\n📋 1. すべての input 要素:');
    const allInputs = await page.$$('input');
    console.log(`   総数: ${allInputs.length}`);
    
    for (let i = 0; i < allInputs.length; i++) {
      const type = await allInputs[i].getAttribute('type');
      const name = await allInputs[i].getAttribute('name');
      const id = await allInputs[i].getAttribute('id');
      const placeholder = await allInputs[i].getAttribute('placeholder');
      const ariaLabel = await allInputs[i].getAttribute('aria-label');
      
      console.log(`   [${i}] type="${type}" name="${name}" id="${id}" placeholder="${placeholder}" aria-label="${ariaLabel}"`);
    }

    // 2. すべてのtextarea要素を分析
    console.log('\n📋 2. すべての textarea 要素:');
    const allTextareas = await page.$$('textarea');
    console.log(`   総数: ${allTextareas.length}`);
    
    for (let i = 0; i < allTextareas.length; i++) {
      const name = await allTextareas[i].getAttribute('name');
      const id = await allTextareas[i].getAttribute('id');
      const placeholder = await allTextareas[i].getAttribute('placeholder');
      const ariaLabel = await allTextareas[i].getAttribute('aria-label');
      
      console.log(`   [${i}] name="${name}" id="${id}" placeholder="${placeholder}" aria-label="${ariaLabel}"`);
    }

    // 3. すべてのcontenteditable要素を分析
    console.log('\n📋 3. すべての contenteditable 要素:');
    const allContentEditable = await page.$$('[contenteditable]');
    console.log(`   総数: ${allContentEditable.length}`);
    
    for (let i = 0; i < allContentEditable.length; i++) {
      const tag = await allContentEditable[i].evaluate(el => el.tagName);
      const role = await allContentEditable[i].getAttribute('role');
      const ariaLabel = await allContentEditable[i].getAttribute('aria-label');
      const className = await allContentEditable[i].getAttribute('class');
      const text = await allContentEditable[i].textContent();
      const dataText = await allContentEditable[i].getAttribute('data-text');
      
      console.log(`   [${i}] <${tag}>`);
      console.log(`       role="${role}"`);
      console.log(`       aria-label="${ariaLabel}"`);
      console.log(`       class="${className?.substring(0, 100)}${className && className.length > 100 ? '...' : ''}"`);
      console.log(`       text="${text?.trim()}"`);
      console.log(`       data-text="${dataText}"`);
    }

    // 4. モーダル内のすべてのdiv[role="textbox"]を分析
    console.log('\n📋 4. すべての div[role="textbox"] 要素:');
    const allTextboxes = await page.$$('div[role="textbox"]');
    console.log(`   総数: ${allTextboxes.length}`);
    
    for (let i = 0; i < allTextboxes.length; i++) {
      const ariaLabel = await allTextboxes[i].getAttribute('aria-label');
      const contenteditable = await allTextboxes[i].getAttribute('contenteditable');
      const className = await allTextboxes[i].getAttribute('class');
      const text = await allTextboxes[i].textContent();
      
      console.log(`   [${i}]`);
      console.log(`       aria-label="${ariaLabel}"`);
      console.log(`       contenteditable="${contenteditable}"`);
      console.log(`       class="${className?.substring(0, 100)}${className && className.length > 100 ? '...' : ''}"`);
      console.log(`       text="${text?.trim()}"`);
    }

    // 5. Postボタンを分析
    console.log('\n📋 5. Post ボタン検索:');
    const allPostButtons = await page.$$('button, div[role="button"]');
    
    for (let i = 0; i < allPostButtons.length; i++) {
      const text = await allPostButtons[i].textContent();
      const ariaLabel = await allPostButtons[i].getAttribute('aria-label');
      
      if (text?.includes('Post') || text?.includes('投稿') || ariaLabel?.includes('Post')) {
        console.log(`   ✅ 発見: text="${text?.trim()}" aria-label="${ariaLabel}"`);
      }
    }

    // 6. モーダル全体のHTMLをダンプ
    console.log('\n📋 6. モーダル全体のHTML構造をファイルに保存...');
    const modalHTML = await modal.evaluate(el => el.outerHTML);
    const htmlPath = '/tmp/threads-modal-structure.html';
    fs.writeFileSync(htmlPath, modalHTML);
    console.log(`   ✅ 保存完了: ${htmlPath}`);

    console.log('\n' + '='.repeat(80));
    console.log('分析完了！');
    console.log('='.repeat(80));

    await context.close();
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
