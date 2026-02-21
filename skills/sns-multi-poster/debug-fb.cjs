const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const cookiesData = JSON.parse(fs.readFileSync('/root/clawd/skills/sns-multi-poster/cookies/facebook.json', 'utf8'));
  await page.setCookie(...cookiesData);
  
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const url = page.url();
  console.log('URL:', url);
  
  await page.screenshot({ path: '/tmp/fb-debug.png', fullPage: false });
  
  // Get all role="button" elements
  const buttons = await page.evaluate(() => {
    const elems = document.querySelectorAll('[role="button"]');
    return Array.from(elems).slice(0, 20).map(e => ({
      text: e.textContent.trim().slice(0, 50),
      aria: e.getAttribute('aria-label'),
    }));
  });
  console.log('Buttons found:', JSON.stringify(buttons, null, 2));
  
  await browser.close();
})().catch(e => console.error('Error:', e.message));
