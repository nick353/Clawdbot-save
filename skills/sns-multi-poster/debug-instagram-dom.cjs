#!/usr/bin/env node
/**
 * Instagram DOM Debugger
 * Instagramのページをロードして、DOM構造を調査
 * 出力: HTML + スクリーンショット + JSON形式の要素情報
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const OUTPUT_DIR = '/tmp/instagram-debug';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function main() {
  console.log('🔍 Instagram DOM Debugger');
  console.log(`📁 Output: ${OUTPUT_DIR}`);

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
    page.setDefaultTimeout(60000);

    // Cookie 読み込み
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      // sameSite を修正
      const fixed_cookies = cookies.map(c => ({
        ...c,
        sameSite: c.sameSite === 'no_restriction' || c.sameSite === 'unspecified' || !c.sameSite 
          ? 'None' 
          : (c.sameSite === 'lax' ? 'Lax' : c.sameSite)
      }));
      await context.addCookies(fixed_cookies);
      console.log(`✅ ${fixed_cookies.length} cookies loaded`);
    }

    // Instagram へアクセス
    console.log('🌐 Accessing Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    console.log('✅ Page loaded');

    // スクリーンショット
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: `${OUTPUT_DIR}/instagram-full.png` });
    console.log(`✅ Screenshot: ${OUTPUT_DIR}/instagram-full.png`);

    // ページ全体 HTML を保存
    console.log('💾 Saving full HTML...');
    const fullHTML = await page.content();
    fs.writeFileSync(`${OUTPUT_DIR}/instagram-full.html`, fullHTML);
    console.log(`✅ HTML: ${OUTPUT_DIR}/instagram-full.html (${fullHTML.length} bytes)`);

    // DOM 分析
    console.log('🔎 Analyzing DOM...');
    const domAnalysis = await page.evaluate(() => {
      const result = {
        isLoggedIn: !!document.querySelector('a[href="/"]'),
        navigation: {
          navElements: document.querySelectorAll('nav').length,
          navLinks: Array.from(document.querySelectorAll('nav a')).map(a => ({
            href: a.getAttribute('href'),
            ariaLabel: a.getAttribute('aria-label'),
            text: a.textContent.trim(),
          })),
        },
        createButton: {
          byAriaLabel: !!document.querySelector('[aria-label="Create"]'),
          bySVG: !!document.querySelector('svg[aria-label="Create"]'),
          byHref: !!document.querySelector('a[href*="/create"]'),
          byText: !!document.querySelector('button:has-text("Create")'),
        },
        buttons: {
          all: document.querySelectorAll('button').length,
          withAriaLabel: Array.from(document.querySelectorAll('button[aria-label]')).map(b => ({
            ariaLabel: b.getAttribute('aria-label'),
            class: b.className,
            text: b.textContent.trim().substring(0, 50),
          })),
        },
        forms: {
          fileInputs: document.querySelectorAll('input[type="file"]').length,
          textareas: document.querySelectorAll('textarea').length,
        },
        sidebarHTML: (() => {
          const nav = document.querySelector('nav');
          return nav ? nav.outerHTML.substring(0, 3000) : 'NOT FOUND';
        })(),
      };
      return result;
    });

    // JSON で保存
    console.log('📊 Saving DOM analysis...');
    fs.writeFileSync(`${OUTPUT_DIR}/dom-analysis.json`, JSON.stringify(domAnalysis, null, 2));
    console.log(`✅ Analysis: ${OUTPUT_DIR}/dom-analysis.json`);

    // 詳細情報を表示
    console.log('\n--- DOM Analysis Results ---');
    console.log(`✅ Logged in: ${domAnalysis.isLoggedIn}`);
    console.log(`nav elements: ${domAnalysis.navigation.navElements}`);
    console.log(`nav links: ${domAnalysis.navigation.navLinks.length}`);
    console.log(`Create button (aria-label="Create"): ${domAnalysis.createButton.byAriaLabel}`);
    console.log(`Create button (SVG): ${domAnalysis.createButton.bySVG}`);
    console.log(`Create button (href="/create"): ${domAnalysis.createButton.byHref}`);
    console.log(`Total buttons: ${domAnalysis.buttons.all}`);
    console.log(`Buttons with aria-label: ${domAnalysis.buttons.withAriaLabel.length}`);
    console.log(`\n🔗 Nav Links:`);
    domAnalysis.navigation.navLinks.forEach(link => {
      console.log(`  - ${link.ariaLabel || link.href || link.text}`);
    });

    console.log(`\n🔘 Buttons with aria-label:`);
    domAnalysis.buttons.withAriaLabel.forEach(btn => {
      console.log(`  - ${btn.ariaLabel}`);
    });

    // Create button のセレクタをテスト
    console.log('\n--- Testing Selectors ---');
    const selectorTests = [
      '[aria-label="Create"]',
      'svg[aria-label="Create"]',
      'a[href*="/create"]',
      'button[aria-label*="Create" i]',
      '[role="link"][aria-label="Create"]',
      'a[aria-label="Create"]',
      'div[aria-label="Create"]',
    ];

    for (const selector of selectorTests) {
      try {
        const found = await page.locator(selector).first().isVisible().catch(() => false);
        console.log(`  ${selector}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      } catch (e) {
        console.log(`  ${selector}: ❌ ERROR (${e.message.split('\n')[0]})`);
      }
    }

    // NavのHTMLを抽出
    const navHTML = await page.locator('nav').first().evaluate(el => el.outerHTML);
    fs.writeFileSync(`${OUTPUT_DIR}/instagram-nav.html`, navHTML);
    console.log(`\n✅ Nav HTML: ${OUTPUT_DIR}/instagram-nav.html`);

    console.log('\n🎉 Debug complete!');
    console.log(`📂 Output directory: ${OUTPUT_DIR}`);
    console.log(`   - instagram-full.png (screenshot)`);
    console.log(`   - instagram-full.html (full page)`);
    console.log(`   - instagram-nav.html (nav element)`);
    console.log(`   - dom-analysis.json (analysis)`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

main();
