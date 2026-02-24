#!/usr/bin/env node
/**
 * SNS UI 構造デバッグスクリプト
 * 各SNSのページを開いてスクリーンショット撮影 + HTML構造を出力
 * 
 * Usage: node debug-sns-ui.cjs <sns_name>
 * sns_name: instagram, threads, x, pinterest
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , snsName] = process.argv;

if (!snsName || !['instagram', 'threads', 'x', 'pinterest'].includes(snsName)) {
  console.error('使い方: node debug-sns-ui.cjs <sns_name>');
  console.error('sns_name: instagram, threads, x, pinterest');
  process.exit(1);
}

const CONFIG = {
  instagram: {
    url: 'https://www.instagram.com/',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/instagram.json',
    profileDir: '/root/clawd/browser-profiles/instagram'
  },
  threads: {
    url: 'https://www.threads.net/',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/threads.json',
    profileDir: '/root/clawd/browser-profiles/threads'
  },
  x: {
    url: 'https://twitter.com/compose/post',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/x.json',
    profileDir: '/root/clawd/browser-profiles/x'
  },
  pinterest: {
    url: 'https://www.pinterest.com/pin-builder/',
    cookiePath: '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json',
    profileDir: '/root/clawd/browser-profiles/pinterest'
  }
};

async function debugUI(sns) {
  const config = CONFIG[sns];
  const outputDir = '/tmp/sns-ui-debug';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`🔍 ${sns.toUpperCase()} UI 構造デバッグ開始...`);
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  // Cookie読み込み
  if (fs.existsSync(config.cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(config.cookiePath, 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Cookie読み込み完了');
  } else {
    console.log('⚠️  Cookie ファイルが見つかりません:', config.cookiePath);
  }

  const page = await context.newPage();

  // ページ読み込み
  console.log(`🌐 ${config.url} にアクセス中...`);
  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // スクリーンショット撮影
  const screenshotPath = path.join(outputDir, `${sns}-1-initial.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 スクリーンショット保存: ${screenshotPath}`);

  // HTML構造を出力
  const htmlPath = path.join(outputDir, `${sns}-1-initial.html`);
  const html = await page.content();
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`📄 HTML保存: ${htmlPath}`);

  // 主要な要素を検索
  console.log('');
  console.log('🔍 主要な要素を検索中...');
  
  const selectors = {
    instagram: [
      'div[aria-label="New post"]',
      'div[role="img"][aria-label="New post"]',
      'a[href="#"]',
      'svg[aria-label="New post"]',
      'input[type="file"]',
      'button:has-text("Create")',
      'button:has-text("New post")'
    ],
    threads: [
      'div[aria-label*="compose"]',
      'div[aria-label*="new post"]',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
      'textarea',
      'button:has-text("投稿")',
      'input[type="file"]'
    ],
    x: [
      'div[aria-label="Post text"]',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="happening"]',
      'button[data-testid="tweetButtonInline"]',
      'input[type="file"]'
    ],
    pinterest: [
      'button:has-text("Create Pin")',
      'a[href*="/pin-builder"]',
      'div[aria-label*="Create"]',
      'input[type="file"]',
      'textarea[placeholder*="description"]'
    ]
  };

  for (const selector of selectors[sns] || []) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        console.log(`  ✅ ${selector} → ${isVisible ? '表示' : '非表示'}`);
      } else {
        console.log(`  ❌ ${selector} → 見つからない`);
      }
    } catch (e) {
      console.log(`  ❌ ${selector} → エラー: ${e.message}`);
    }
  }

  // 全てのボタン要素を列挙
  console.log('');
  console.log('🔍 全てのボタン要素を列挙...');
  const buttons = await page.$$('button');
  console.log(`  ボタン総数: ${buttons.length}`);
  
  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const button = buttons[i];
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    const dataTestId = await button.getAttribute('data-testid');
    console.log(`  [${i}] text="${text?.trim()}" aria-label="${ariaLabel}" data-testid="${dataTestId}"`);
  }

  // 全ての input[type="file"] を列挙
  console.log('');
  console.log('🔍 全ての input[type="file"] を列挙...');
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`  ファイル入力総数: ${fileInputs.length}`);
  
  for (let i = 0; i < fileInputs.length; i++) {
    const input = fileInputs[i];
    const accept = await input.getAttribute('accept');
    const multiple = await input.getAttribute('multiple');
    console.log(`  [${i}] accept="${accept}" multiple="${multiple}"`);
  }

  await browser.close();
  
  console.log('');
  console.log('=========================================');
  console.log(`✅ ${sns.toUpperCase()} UI 構造デバッグ完了`);
  console.log('=========================================');
  console.log(`📸 スクリーンショット: ${screenshotPath}`);
  console.log(`📄 HTML: ${htmlPath}`);
}

(async () => {
  try {
    await debugUI(snsName);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
})();
