#!/usr/bin/env node
/**
 * Instagram v12-final
 * アップロード後のページ更新を適切に待機
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const imagePathArg = args[0];
const captionArg = args[1] || '';

if (!imagePathArg || !fs.existsSync(imagePathArg)) {
  console.error('❌ Usage: post-to-instagram-v12-final.cjs <image-path> [caption]');
  process.exit(1);
}

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      // Fix sameSite attribute
      const fixedCookies = cookies.map(c => ({
        ...c,
        sameSite: (c.sameSite === 'unspecified' || !c.sameSite) ? 'Lax' : c.sameSite
      }));
      console.log(`✅ Loaded ${fixedCookies.length} cookies`);
      return fixedCookies;
    } catch (e) {
      console.warn('⚠️ Failed to parse cookies');
      return [];
    }
  }
  return [];
}

async function main() {
  console.log('🚀 Instagram v12-final - Robust upload + wait');

  let browser;
  let context;

  try {
    // Launch
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

    // Load cookies
    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Navigate to /create
    console.log('🌐 Loading Instagram /create...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded', timeout: 15000,
      timeout: 120000,
    });
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('Cookies are invalid - still on login page');
    }
    console.log('✅ /create loaded');

    // Wait for page to render
    console.log('⏳ Waiting for page rendering...');
    await page.waitForTimeout(5000);

    // Upload file
    console.log('📁 Uploading file...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePathArg);
    console.log('✅ File uploaded');

    // Wait for page to update after upload
    console.log('⏳ Waiting for page update after upload (15s)...');
    
    // Next ボタンを待つ（最大15秒）
    let nextVisible = false;
    for (let i = 0; i < 15; i++) {
      const nextBtn = page.locator('button:has-text("Next")').first();
      try {
        if (await nextBtn.isVisible({ timeout: 1000 })) {
          nextVisible = true;
          console.log(`✅ Next button appeared after ${i + 1} seconds`);
          break;
        }
      } catch {
        // Still waiting
        if (i % 3 === 0) {
          console.log(`  Still waiting (${i}s)...`);
        }
      }
    }

    if (!nextVisible) {
      // デバッグスクリーンショット
      await page.screenshot({ path: '/tmp/instagram-v12-waiting.png', fullPage: true });
      
      // DOM debug
      const buttons = await page.locator('button').all();
      console.log(`📊 Found ${buttons.length} buttons`);
      for (let i = 0; i < Math.min(10, buttons.length); i++) {
        const text = await buttons[i].textContent();
        console.log(`  Button ${i}: "${text}"`);
      }
      
      throw new Error('Next button did not appear after 15s');
    }

    // Click Next
    console.log('🖱️ Clicking Next...');
    const nextBtn = page.locator('button:has-text("Next")').first();
    await nextBtn.click();
    console.log('✅ Next clicked');

    // Wait for next page
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
    await shareBtn.click();
    console.log('✅ Share clicked');

    // Wait for completion
    await page.waitForTimeout(5000);
    console.log('🎉 Done! Post should be published');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
