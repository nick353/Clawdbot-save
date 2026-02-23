#!/usr/bin/env node
/**
 * Instagram - Debug Version
 * /create ページの詳細な DOM 分析
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies', 'instagram.json');
const imagePathArg = process.argv[2];

if (!imagePathArg) {
  console.error('❌ Usage: post-to-instagram-debug.cjs <image-path>');
  process.exit(1);
}

async function main() {
  console.log('🔍 Instagram /create Debug Mode');
  
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(120000);

    // Cookies
    console.log('\n📂 Loading cookies...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await context.addCookies(cookies);
      console.log(`✅ Loaded ${cookies.length} cookies`);
    }

    // Home
    console.log('\n🌐 Loading Home...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    console.log('✅ Home loaded');

    // /create
    console.log('\n🌐 Loading /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    console.log(`✅ /create loaded (URL: ${page.url()})`);

    // Wait
    console.log('\n⏳ Waiting for page to render (10s)...');
    await page.waitForTimeout(10000);

    // Detailed DOM analysis
    console.log('\n📊 Detailed DOM Analysis:');
    
    const domInfo = await page.evaluate(() => {
      return {
        // Basic info
        title: document.title,
        url: window.location.href,
        readyState: document.readyState,
        
        // Element counts
        inputs_all: document.querySelectorAll('input').length,
        inputs_file: document.querySelectorAll('input[type="file"]').length,
        inputs_text: document.querySelectorAll('input[type="text"]').length,
        buttons: document.querySelectorAll('button').length,
        textareas: document.querySelectorAll('textarea').length,
        iframes: document.querySelectorAll('iframe').length,
        
        // Check for specific elements
        has_file_input: !!document.querySelector('input[type="file"]'),
        has_canvas: !!document.querySelector('canvas'),
        has_video: !!document.querySelector('video'),
        
        // Look for upload areas
        has_dropzone: !!document.querySelector('[data-testid="create"]') || 
                     !!document.querySelector('.upload') ||
                     !!document.querySelector('[role="dialog"]'),
        
        // Get all text content length
        bodyTextLength: document.body.innerText.length,
        
        // Check for React/Vue
        has_react: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
                  Object.keys(document.documentElement).some(key => key.startsWith('__react')),
        
        // All input types
        input_types: Array.from(document.querySelectorAll('input')).map((el, i) => ({
          index: i,
          type: el.type,
          name: el.name,
          id: el.id,
          class: el.className.substring(0, 50),
          visible: el.offsetParent !== null,
        })).slice(0, 10),
        
        // All button texts (first 10)
        button_texts: Array.from(document.querySelectorAll('button'))
          .map(b => b.innerText.trim())
          .filter(t => t.length > 0)
          .slice(0, 10),
      };
    });

    console.log(JSON.stringify(domInfo, null, 2));

    // Try alternate selectors
    console.log('\n🔍 Trying alternate selectors...');
    
    const selectors = [
      'input[type="file"]',
      '[data-testid*="file"]',
      '[data-testid*="upload"]',
      '.upload input',
      '[role="button"][tabindex="0"]',
      'div[data-testid="create"]',
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        console.log(`  ✅ Found ${count} elements: ${sel}`);
      }
    }

    // Screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: '/tmp/instagram-debug.png', fullPage: true });
    console.log('✅ Screenshot saved: /tmp/instagram-debug.png');

    // Try clicking on visible elements
    console.log('\n🖱️ Analyzing clickable elements...');
    const clickables = await page.evaluate(() => {
      const elements = document.querySelectorAll('[role="button"], button, a[href*="create"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        text: el.innerText?.substring(0, 50),
        visible: el.offsetParent !== null,
        class: el.className.substring(0, 60),
      })).slice(0, 15);
    });
    
    console.log(JSON.stringify(clickables, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
