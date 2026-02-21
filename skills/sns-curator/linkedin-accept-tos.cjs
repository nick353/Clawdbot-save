const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

async function main() {
  const cookies = JSON.parse(fs.readFileSync('./cookies/linkedin.json', 'utf8'));
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-gpu','--memory-pressure-off','--js-flags=--max-old-space-size=256']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setCookie(...cookies);
  
  // アカウント選択 → 1つ目をクリック
  await page.goto('https://www.linkedin.com/uas/login?session_redirect=https%3A%2F%2Fwww.linkedin.com%2Ffeed%2F', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 2000));
  
  // 1つ目のアカウントをクリック
  await page.evaluate(() => {
    const link = document.querySelector('ul li:first-child a');
    if (link) link.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('URL after account select:', page.url());
  
  // 利用規約ページのボタンを全部探す
  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], a.btn, a[class*="btn"]'));
    return btns.map(b => ({
      tag: b.tagName,
      text: b.textContent.trim().substring(0, 50),
      class: b.className.substring(0, 60),
      id: b.id
    }));
  });
  console.log('ボタン一覧:', JSON.stringify(buttons, null, 2));
  
  await page.screenshot({ path: '/tmp/li-tos-full.png', fullPage: true });
  await browser.close();
}
main().catch(e => console.error('ERROR:', e.message));
