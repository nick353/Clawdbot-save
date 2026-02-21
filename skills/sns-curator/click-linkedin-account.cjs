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
  
  console.log('LinkedIn にアクセス中...');
  await page.goto('https://www.linkedin.com/uas/login?session_redirect=https%3A%2F%2Fwww.linkedin.com%2Ffeed%2F', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 2000));
  
  const url = page.url();
  console.log('現在のURL:', url);
  await page.screenshot({ path: '/tmp/li-before-click.png' });
  
  // 1つ目のアカウントをクリック
  const clicked = await page.evaluate(() => {
    // アカウント選択の1つ目の要素を探す
    const selectors = [
      '.account-picker__account:first-child',
      '[data-tracking-id]:first-child',
      'li:first-child .account-picker__account-name',
      '.account-picker__accounts li:first-child',
      '[role="option"]:first-child',
      'ul li:first-child a',
      '.authentication-outlet li:first-child',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log('クリック:', sel);
        el.click();
        return sel;
      }
    }
    // フォールバック: テキストで探す
    const allLinks = Array.from(document.querySelectorAll('a, button, [role="button"], li'));
    const accountLink = allLinks.find(el => el.textContent.includes('@gmail.com') && el.textContent.includes('n'));
    if (accountLink) {
      accountLink.click();
      return 'email-based click';
    }
    return null;
  });
  
  console.log('クリック結果:', clicked);
  await new Promise(r => setTimeout(r, 3000));
  
  const newUrl = page.url();
  console.log('クリック後のURL:', newUrl);
  await page.screenshot({ path: '/tmp/li-after-click.png' });
  
  await browser.close();
  console.log('スクリーンショット保存: /tmp/li-after-click.png');
}
main().catch(e => console.error('ERROR:', e.message));
