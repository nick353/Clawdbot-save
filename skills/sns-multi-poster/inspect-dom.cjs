#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Cookie
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
      name: c.name,
      value: decodeURIComponent(c.value),
      domain: c.domain || '.instagram.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly === true,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
    }));
    await page.setCookie(...cookies);

    // Instagram
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 4000));

    // Create
    const createBtn = await page.$('svg[aria-label="New post"]');
    if (createBtn) {
      await createBtn.click();
      console.log('✅ Createクリック');
      await new Promise(r => setTimeout(r, 5000));
    }

    // DOM構造を調査
    const menuInfo = await page.evaluate(() => {
      const results = [];
      
      // 全てのspanとdivを調査
      const elements = Array.from(document.querySelectorAll('span, div, a'));
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        if (text === 'Post' || text === 'Live video' || text === 'Ad') {
          const rect = el.getBoundingClientRect();
          results.push({
            tag: el.tagName,
            text: text,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className,
            outerHTML: el.outerHTML.substring(0, 200)
          });
        }
      }
      
      return results;
    });

    console.log('\n📋 Postメニュー項目のDOM情報:');
    console.log(JSON.stringify(menuInfo, null, 2));

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
