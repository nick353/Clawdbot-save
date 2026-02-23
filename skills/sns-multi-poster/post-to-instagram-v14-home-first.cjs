#!/usr/bin/env node
/**
 * Instagram v14-home-first
 * Home ページから Create ボタンをクリック → フロー開始
 * /create URL の直接アクセスではなく、自然なUIフロー
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-v14-home-first.cjs <image-path> [caption]');
  process.exit(1);
}

if (!fs.existsSync(imagePathArg)) {
  console.error(`❌ Image not found: ${imagePathArg}`);
  process.exit(1);
}

async function main() {
  console.log('🚀 Instagram v14-home-first');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  let context;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    
    // Stealth
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);

    // Load cookies
    console.log('🔐 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies`);
    }

    // Home page
    console.log('🌐 Loading Instagram home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log('✅ Home loaded');

    // 左ナビがロードされるまで待つ
    console.log('⏳ Waiting for navigation to load (3s)...');
    await page.waitForTimeout(3000);

    // Create button を探して クリック
    console.log('🔍 Looking for Create button...');
    
    // 複数のセレクタを試す
    const createSelectors = [
      '[aria-label="Create"]',           // モダンUI
      'a[href*="/create"]',              // リンク
      'svg[aria-label="Create"]',        // SVGアイコン
      'button:has-text("Create")',       // ボタン
      'button:has(svg[aria-label="Create"])', // SVG内包ボタン
    ];

    let createClicked = false;
    for (const selector of createSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`  Trying selector: ${selector}`);
          await element.click();
          createClicked = true;
          console.log(`✅ Create clicked with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!createClicked) {
      console.error('❌ Create button not found in any selector');
      console.error('   Trying alternative: page.evaluate()');
      
      // JavaScriptで直接クリック
      const found = await page.evaluate(() => {
        // SVGで "Create" を探す
        const svgs = document.querySelectorAll('svg');
        for (const svg of svgs) {
          if (svg.getAttribute('aria-label') === 'Create') {
            const button = svg.closest('button') || svg.closest('[role="button"]') || svg.closest('a');
            if (button) {
              button.click();
              return true;
            }
          }
        }
        
        // テキストで "Create" を探す
        for (const el of document.querySelectorAll('button, [role="button"], a')) {
          if (el.innerText === 'Create' || el.textContent === 'Create') {
            el.click();
            return true;
          }
        }
        
        return false;
      });
      
      if (!found) {
        throw new Error('Create button not found after JavaScript evaluation');
      }
      console.log('✅ Create clicked with JavaScript');
    }

    // ページが更新されるまで待つ
    console.log('⏳ Waiting for Create modal to appear (5s)...');
    await page.waitForTimeout(5000);

    // ファイル入力を探す
    console.log('📁 Checking for file input...');
    const fileInputCount = await page.locator('input[type="file"]').count();
    
    if (fileInputCount === 0) {
      // スクリーンショット
      await page.screenshot({ path: '/tmp/instagram-v14-create-modal.png' });
      throw new Error('No file input found after clicking Create');
    }

    console.log(`✅ Found ${fileInputCount} file input(s)`);

    // アップロード
    console.log('📁 Uploading image...');
    await page.locator('input[type="file"]').first().setInputFiles(imagePathArg);
    console.log('✅ Image uploaded');

    // ページが反応するまで待つ
    console.log('⏳ Waiting for page reaction (8s)...');
    await page.waitForTimeout(8000);

    // Next ボタン
    console.log('🔍 Looking for Next button...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    
    if (!await nextBtn.isVisible({ timeout: 10000 })) {
      await page.screenshot({ path: '/tmp/instagram-v14-no-next.png' });
      throw new Error('Next button not found after upload');
    }

    await nextBtn.click();
    console.log('✅ Next clicked');

    // 少し待機
    await page.waitForTimeout(3000);

    // Caption (optional)
    if (captionArg.trim()) {
      console.log('📝 Entering caption...');
      const textareas = await page.locator('textarea').all();
      if (textareas.length > 0) {
        await textareas[0].fill(captionArg);
        console.log('✅ Caption entered');
      }
    }

    // Share
    console.log('📤 Clicking Share...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    
    if (!await shareBtn.isVisible({ timeout: 10000 })) {
      throw new Error('Share button not found');
    }
    
    await shareBtn.click();
    console.log('✅ Share clicked');

    // 完了待機
    await page.waitForTimeout(5000);
    console.log('🎉 Post completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
