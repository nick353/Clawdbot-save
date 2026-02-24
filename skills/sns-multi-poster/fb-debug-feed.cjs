#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');

async function debugFacebookFeed() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext({
      storageState: '/root/clawd/skills/sns-multi-poster/cookies/facebook.json',
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    console.log('📱 Facebookフィードにアクセス中...');
    await page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    // スクリーンショット保存
    const screenshotPath = '/tmp/fb-feed-debug.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✅ スクリーンショット保存: ${screenshotPath}`);

    // HTML保存
    const html = await page.content();
    const htmlPath = '/tmp/fb-feed-debug.html';
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ HTML保存: ${htmlPath}`);

    // 投稿作成ボタンを探す
    console.log('\n🔍 投稿作成ボタンを検索中...');

    // 候補セレクタをテスト
    const selectors = [
      'div[role="button"][aria-label*="Create"]',
      'div[role="button"][aria-label*="作成"]',
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("何か思いついた")',
      '[data-pagelet="FeedUnit_0"] div[role="button"]',
      'div[aria-label*="Write something"]',
      'div[aria-label*="何か書く"]',
      'span:has-text("What\'s on your mind")',
      'span:has-text("何か思いついた")'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          const ariaLabel = await element.getAttribute('aria-label');
          console.log(`✅ 見つかった: ${selector}`);
          console.log(`   テキスト: ${text?.trim()}`);
          console.log(`   aria-label: ${ariaLabel}`);
        }
      } catch (e) {
        // セレクタが見つからない
      }
    }

    // すべてのrole="button"要素を取得
    console.log('\n📋 すべてのrole="button"要素:');
    const buttons = await page.$$('div[role="button"]');
    console.log(`   合計: ${buttons.length}個`);

    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      const btn = buttons[i];
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      if (text?.includes('mind') || text?.includes('思い') || ariaLabel?.includes('Create') || ariaLabel?.includes('作成')) {
        console.log(`   [${i}] テキスト: ${text?.trim()?.substring(0, 50)}`);
        console.log(`       aria-label: ${ariaLabel}`);
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

debugFacebookFeed().catch(console.error);
