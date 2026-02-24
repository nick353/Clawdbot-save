#!/usr/bin/env node
/**
 * Instagram ファイル入力要素デバッグ
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies', 'instagram.json');
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
      const fixedCookies = cookies.map(c => ({
        ...c,
        sameSite: (c.sameSite === 'unspecified' || !c.sameSite) ? 'Lax' : 
                  (c.sameSite === 'no_restriction') ? 'None' :
                  (c.sameSite === 'lax') ? 'Lax' :
                  (c.sameSite === 'strict') ? 'Strict' :
                  (c.sameSite === 'none') ? 'None' : c.sameSite
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
  console.log('🔍 File Input Element Debug');

  let browser;
  let context;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
      ],
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    console.log('🌐 Loading /create/select...');
    await page.goto('https://www.instagram.com/create/select/', {
      waitUntil: 'commit',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // ファイル入力要素を全て列挙
    console.log('\n📋 All file input elements:');
    const fileInputs = await page.locator('input[type="file"]').all();
    console.log(`Found ${fileInputs.length} file input(s)`);
    
    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const id = await input.getAttribute('id').catch(() => '');
      const name = await input.getAttribute('name').catch(() => '');
      const accept = await input.getAttribute('accept').catch(() => '');
      const multiple = await input.getAttribute('multiple').catch(() => 'false');
      const visible = await input.isVisible().catch(() => false);
      const disabled = await input.isDisabled().catch(() => false);
      
      console.log(`\nFile Input #${i}:`);
      console.log(`  id: ${id || '(none)'}`);
      console.log(`  name: ${name || '(none)'}`);
      console.log(`  accept: ${accept || '(none)'}`);
      console.log(`  multiple: ${multiple}`);
      console.log(`  visible: ${visible}`);
      console.log(`  disabled: ${disabled}`);
    }

    // HTML を取得してファイル入力要素の周辺を確認
    console.log('\n📄 Page HTML around file inputs:');
    const html = await page.content();
    const fileInputMatches = html.match(/<input[^>]*type=['"]file['"][^>]*>/gi) || [];
    fileInputMatches.forEach((match, i) => {
      console.log(`\nMatch #${i}:`);
      console.log(match);
    });

    // ボタンを列挙
    console.log('\n📋 Clickable elements:');
    const buttons = await page.locator('button, a[role="button"], div[role="button"]').all();
    console.log(`Found ${buttons.length} button-like elements`);
    
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      const btn = buttons[i];
      const text = await btn.textContent().catch(() => '');
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      const visible = await btn.isVisible().catch(() => false);
      
      if (visible && (text || ariaLabel)) {
        console.log(`  - "${text || ariaLabel}"`);
      }
    }

    // スクリーンショット
    const screenshotPath = path.join(__dirname, 'debug-file-input-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved: debug-file-input-page.png`);

    console.log('\n✅ Debug completed');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
