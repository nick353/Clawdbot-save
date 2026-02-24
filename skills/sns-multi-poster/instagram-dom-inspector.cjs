#!/usr/bin/env node
/**
 * Instagram DOM Inspector - 最新のセレクタを調査
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function loadCookies() {
  const cookiePath = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
  if (fs.existsSync(cookiePath)) {
    try {
      const data = fs.readFileSync(cookiePath, 'utf-8');
      const cookies = JSON.parse(data);
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
  console.log('🔍 Instagram DOM Inspector - Analyzing /create page...\n');

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

    context = await browser.newContext();

    const cookies = await loadCookies();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    // Navigate
    console.log('🌐 Loading Instagram /create...');
    await page.goto('https://www.instagram.com/create/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login')) {
      throw new Error('❌ Cookies are invalid - redirected to login');
    }

    console.log('✅ Loaded /create page\n');

    // Wait for rendering
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({ path: '/tmp/instagram-create-page.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/instagram-create-page.png\n');

    // Analyze buttons
    console.log('🔍 Analyzing buttons...\n');
    const buttons = await page.locator('button').all();
    console.log(`📊 Found ${buttons.length} buttons:\n`);

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const text = await btn.textContent().catch(() => '');
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      const className = await btn.getAttribute('class').catch(() => '');
      const role = await btn.getAttribute('role').catch(() => '');
      const type = await btn.getAttribute('type').catch(() => '');
      const dataTestId = await btn.getAttribute('data-testid').catch(() => '');
      
      console.log(`Button ${i}:`);
      console.log(`  Text: "${text.trim()}"`);
      if (ariaLabel) console.log(`  aria-label: "${ariaLabel}"`);
      if (dataTestId) console.log(`  data-testid: "${dataTestId}"`);
      if (type) console.log(`  type: "${type}"`);
      if (role) console.log(`  role: "${role}"`);
      console.log(`  class: "${className.substring(0, 80)}..."`);
      console.log('');
    }

    // Analyze file inputs
    console.log('\n🔍 Analyzing file inputs...\n');
    const fileInputs = await page.locator('input[type="file"]').all();
    console.log(`📊 Found ${fileInputs.length} file inputs:\n`);

    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const accept = await input.getAttribute('accept').catch(() => '');
      const name = await input.getAttribute('name').catch(() => '');
      const id = await input.getAttribute('id').catch(() => '');
      
      console.log(`File Input ${i}:`);
      if (accept) console.log(`  accept: "${accept}"`);
      if (name) console.log(`  name: "${name}"`);
      if (id) console.log(`  id: "${id}"`);
      console.log('');
    }

    // Analyze textareas
    console.log('\n🔍 Analyzing textareas...\n');
    const textareas = await page.locator('textarea').all();
    console.log(`📊 Found ${textareas.length} textareas:\n`);

    for (let i = 0; i < textareas.length; i++) {
      const textarea = textareas[i];
      const placeholder = await textarea.getAttribute('placeholder').catch(() => '');
      const ariaLabel = await textarea.getAttribute('aria-label').catch(() => '');
      const name = await textarea.getAttribute('name').catch(() => '');
      
      console.log(`Textarea ${i}:`);
      if (placeholder) console.log(`  placeholder: "${placeholder}"`);
      if (ariaLabel) console.log(`  aria-label: "${ariaLabel}"`);
      if (name) console.log(`  name: "${name}"`);
      console.log('');
    }

    // Get page HTML (first 5000 chars)
    console.log('\n📄 Page HTML (first 5000 chars):\n');
    const html = await page.content();
    console.log(html.substring(0, 5000));
    console.log('\n...(truncated)\n');

    // Save full HTML
    fs.writeFileSync('/tmp/instagram-create-page.html', html);
    console.log('💾 Full HTML saved: /tmp/instagram-create-page.html\n');

    console.log('✅ DOM inspection complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
