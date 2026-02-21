/**
 * Instagram UI Inspector
 * 現在のInstagram UIを調査して、投稿ボタンのセレクタを特定する
 */

const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('🔍 Instagram UI Inspector starting...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ],
    userDataDir: path.join(process.env.HOME, '.config', 'puppeteer-instagram')
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('📱 Opening Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for page to fully render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = '/tmp/instagram-ui.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Check login status
    const isLoggedIn = await page.evaluate(() => {
      // Check for common logged-in indicators
      return !document.querySelector('input[name="username"]');
    });

    console.log(`\n🔐 Login Status: ${isLoggedIn ? '✅ Logged In' : '❌ Not Logged In'}`);

    if (!isLoggedIn) {
      console.log('\n⚠️ Not logged in. Using existing browser profile session.');
      console.log('If cookies exist, they should be loaded automatically.');
    } else {
      console.log('\n✅ Already logged in!');
    }

    // Search for create post buttons
    console.log('\n🔎 Searching for create post buttons...\n');

    const buttonSelectors = [
      'a[href="#"]',
      'a[href="/"]',
      'svg[aria-label*="New"]',
      'svg[aria-label*="作成"]',
      'svg[aria-label*="Create"]',
      'svg[aria-label*="投稿"]',
      '[role="link"]',
      'a[role="link"]'
    ];

    const foundButtons = [];

    for (const selector of buttonSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          const element = elements[i];
          const info = await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return {
              tagName: el.tagName,
              ariaLabel: el.getAttribute('aria-label'),
              href: el.getAttribute('href'),
              text: el.textContent?.trim().substring(0, 50),
              role: el.getAttribute('role'),
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              innerHTML: el.innerHTML.substring(0, 200)
            };
          }, element);
          
          foundButtons.push({
            selector,
            index: i,
            ...info
          });
        }
      }
    }

    console.log('Found elements:');
    foundButtons.forEach((btn, idx) => {
      console.log(`\n[${idx + 1}] Selector: ${btn.selector} (index: ${btn.index})`);
      console.log(`    Tag: ${btn.tagName}`);
      console.log(`    Aria-label: ${btn.ariaLabel || 'none'}`);
      console.log(`    Href: ${btn.href || 'none'}`);
      console.log(`    Text: ${btn.text || 'none'}`);
      console.log(`    Position: (${btn.x}, ${btn.y})`);
      console.log(`    Size: ${btn.width}x${btn.height}`);
    });

    // Look specifically for "New post" or "作成" buttons
    const createButtons = foundButtons.filter(btn => 
      btn.ariaLabel?.match(/(new|create|作成|投稿|plus)/i) ||
      btn.text?.match(/(new|create|作成|投稿)/i)
    );

    console.log('\n\n🎯 Likely "Create Post" buttons:');
    if (createButtons.length > 0) {
      createButtons.forEach((btn, idx) => {
        console.log(`\n[${idx + 1}] ${btn.selector} (index: ${btn.index})`);
        console.log(`    Aria-label: ${btn.ariaLabel}`);
        console.log(`    Text: ${btn.text}`);
      });
    } else {
      console.log('❌ No obvious create buttons found');
    }

    console.log('\n\n✅ Inspection complete. Check the screenshots and output above.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
