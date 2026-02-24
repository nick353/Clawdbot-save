#!/usr/bin/env node
/**
 * "Post" ボタンのセレクタを調査
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
      return fixedCookies;
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function main() {
  let browser;
  let context;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    console.log('Loading Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    console.log('Clicking Create button...');
    const createBtn = page.locator('a[href="#"]:has(svg[aria-label="New post"])').first();
    await createBtn.click();
    await page.waitForTimeout(2000);

    console.log('\n📋 All elements containing "Post":');
    const postElements = await page.locator('text="Post"').all();
    console.log(`Found ${postElements.length} elements`);

    for (let i = 0; i < postElements.length; i++) {
      const el = postElements[i];
      const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown');
      const className = await el.getAttribute('class').catch(() => '');
      const role = await el.getAttribute('role').catch(() => '');
      const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
      const textContent = await el.textContent().catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      
      if (visible) {
        console.log(`\nElement #${i}:`);
        console.log(`  Tag: ${tagName}`);
        console.log(`  Text: ${textContent.trim()}`);
        console.log(`  Class: ${className}`);
        console.log(`  Role: ${role || '(none)'}`);
        console.log(`  Aria-label: ${ariaLabel || '(none)'}`);
        
        // 親要素を確認
        const parentTag = await el.evaluate(e => e.parentElement?.tagName).catch(() => 'unknown');
        const parentRole = await el.evaluate(e => e.parentElement?.getAttribute('role')).catch(() => '');
        console.log(`  Parent: ${parentTag} (role: ${parentRole || 'none'})`);
      }
    }

    console.log('\n📋 All clickable elements:');
    const clickables = await page.locator('a, button, div[role="button"]').all();
    console.log(`Found ${clickables.length} clickable elements`);

    for (let i = 0; i < Math.min(clickables.length, 30); i++) {
      const el = clickables[i];
      const textContent = await el.textContent().catch(() => '');
      const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      
      if (visible && (textContent.includes('Post') || ariaLabel?.includes('Post'))) {
        const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown');
        const role = await el.getAttribute('role').catch(() => '');
        
        console.log(`\nClickable #${i}:`);
        console.log(`  Tag: ${tagName}`);
        console.log(`  Text: ${textContent.trim()}`);
        console.log(`  Aria-label: ${ariaLabel || '(none)'}`);
        console.log(`  Role: ${role || '(none)'}`);
      }
    }

    // スクリーンショット
    await page.screenshot({ 
      path: path.join(__dirname, 'debug-post-button.png'),
      fullPage: false 
    });
    console.log('\n📸 Screenshot saved: debug-post-button.png');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
