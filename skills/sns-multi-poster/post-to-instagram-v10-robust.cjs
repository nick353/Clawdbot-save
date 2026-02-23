#!/usr/bin/env node
/**
 * Instagram v10-robust
 * より堅牢：長い待機 + DOM確認 + スクリーンショット付きデバッグ
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v10-robust.cjs <image-path> [caption]');
  process.exit(1);
}

async function waitForElement(page, selector, timeout = 15000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 Instagram v10-robust - Enhanced detection');

  let browser;
  let context;

  try {
    // Chrome User Data Directory
    let userDataDir = null;
    const linuxChromeDir = path.join(os.homedir(), '.config/google-chrome');
    const linuxChromiumDir = path.join(os.homedir(), '.config/chromium');

    if (fs.existsSync(linuxChromeDir)) {
      userDataDir = linuxChromeDir;
    } else if (fs.existsSync(linuxChromiumDir)) {
      userDataDir = linuxChromiumDir;
    }

    // Launch
    if (userDataDir && fs.existsSync(userDataDir)) {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      browser = context._browser;
    } else {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      context = await browser.newContext();
    }

    const pages = context.pages();
    let page = pages[0] || await context.newPage();

    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Step 1: Home
    console.log('🌐 Step 1: Loading Instagram home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 120000,
    });
    console.log('✅ Home loaded');

    // Step 2: /create へナビゲート
    console.log('🌐 Step 2: Navigating to /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    console.log('✅ /create loaded');

    // Step 3: ページが十分に読み込まれるまで待機
    console.log('⏳ Step 3: Waiting for page to fully render (10s)...');
    await page.waitForTimeout(10000);

    // DOM スクリーンショット
    const domStructure = await page.evaluate(() => {
      const inputs = [];
      
      // input[type="file"]
      document.querySelectorAll('input[type="file"]').forEach((el, i) => {
        inputs.push(`file-input-${i}: ${el.id || el.name || 'no-id'}`);
      });
      
      // input[type="text"]
      document.querySelectorAll('input[type="text"]').forEach((el, i) => {
        inputs.push(`text-input-${i}: ${el.id || el.name || 'placeholder:' + (el.placeholder || 'none')}`);
      });
      
      // textarea
      document.querySelectorAll('textarea').forEach((el, i) => {
        inputs.push(`textarea-${i}: ${el.id || el.name || 'no-id'}`);
      });
      
      // buttons
      const buttons = [];
      document.querySelectorAll('button').forEach((el, i) => {
        if (el.textContent.length < 100) {
          buttons.push(el.textContent.trim().substring(0, 50));
        }
      });
      
      // role=button elements
      document.querySelectorAll('[role="button"]').forEach((el, i) => {
        if (el.textContent && el.textContent.length < 100) {
          buttons.push(`role-button: ${el.textContent.trim().substring(0, 50)}`);
        }
      });
      
      return {
        url: window.location.href,
        title: document.title,
        inputs: inputs.slice(0, 20),
        buttons: buttons.slice(0, 20),
        bodyText: document.body.innerText.substring(0, 500),
      };
    });

    console.log('\n📊 DOM Analysis:');
    console.log(`  URL: ${domStructure.url}`);
    console.log(`  Title: ${domStructure.title}`);
    console.log(`  Inputs found: ${domStructure.inputs.length}`);
    domStructure.inputs.forEach(inp => console.log(`    - ${inp}`));
    console.log(`  Buttons found: ${domStructure.buttons.length}`);
    domStructure.buttons.slice(0, 10).forEach(btn => console.log(`    - ${btn}`));
    console.log('');

    // スクリーンショット
    console.log('📸 Taking screenshot for debugging...');
    await page.screenshot({ path: '/tmp/instagram-v10-dom.png', fullPage: true });

    // Step 4: ファイル入力を探す
    console.log('📁 Step 4: Looking for file input...');
    
    const fileInputExists = await waitForElement(page, 'input[type="file"]', 20000);
    if (fileInputExists) {
      console.log('✅ File input found! Uploading...');
      await page.locator('input[type="file"]').first().setInputFiles(imagePathArg);
      console.log('✅ File uploaded');
    } else {
      console.error('❌ File input not found');
      console.error('   This may indicate: not logged in, different UI structure, or dynamic loading failure');
      process.exit(1);
    }

    // Step 5: Next ボタン
    console.log('⏳ Step 5: Waiting for Next button...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 10000 })) {
      await nextBtn.click();
      console.log('✅ Next clicked');
    } else {
      throw new Error('Next button not visible');
    }

    // Step 6: Caption
    if (captionArg.trim()) {
      console.log('📝 Step 6: Entering caption...');
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 5000 })) {
        await textarea.fill(captionArg);
        console.log('✅ Caption entered');
      }
    }

    // Step 7: Share
    console.log('📤 Step 7: Clicking Share...');
    const shareBtn = page.locator('button:has-text("Share")').first();
    if (await shareBtn.isVisible({ timeout: 10000 })) {
      await shareBtn.click();
      console.log('✅ Share clicked');
    } else {
      throw new Error('Share button not visible');
    }

    // Step 8: 完了待機
    console.log('⏳ Waiting for completion...');
    await page.waitForTimeout(5000);
    console.log('🎉 Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
