const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json';
const OUTPUT_FILE = process.argv[2];
const KEYWORDS = ['ukiyoe', 'japanese art woodblock print', 'japanese woodblock'];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function collectBuzz() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const allPins = [];

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      await page.setCookie(...cookies);
      console.log('🔐 Pinterest Cookie設定完了');
    } else {
      throw new Error(`Cookieファイルなし: ${COOKIES_PATH}`);
    }

    for (const kw of KEYWORDS) {
      console.log(`\n🔍 キーワード "${kw}" を調査中...`);
      const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(kw)}&rs=typed`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
          console.error('❌ ログイン必要');
          continue;
        }

        // スクロールで追加読み込み
        for (let i = 0; i < 4; i++) {
          await page.evaluate(() => window.scrollBy(0, 800));
          await sleep(1500);
        }

        const pins = await page.evaluate(() => {
          const results = [];
          // Pinterestのピン要素
          const pinEls = document.querySelectorAll('[data-test-id="pin"], div[class*="Pin"], [data-grid-item="true"]');
          pinEls.forEach(pin => {
            const img = pin.querySelector('img');
            const link = pin.querySelector('a[href*="/pin/"]');
            const descEl = pin.querySelector('p, span[class*="desc"], [class*="title"]');

            // 保存数を取得試行
            const saveEl = pin.querySelector('[aria-label*="save"], [aria-label*="保存"]');
            let saves = 0;
            if (saveEl) {
              const m = (saveEl.textContent || '').match(/[\d,]+/);
              if (m) saves = parseInt(m[0].replace(/,/g, ''), 10);
            }

            const pinUrl = link ? link.getAttribute('href') : '';
            const fullUrl = pinUrl.startsWith('http') ? pinUrl : `https://www.pinterest.com${pinUrl}`;
            const description = descEl ? descEl.textContent.substring(0, 200) : '';
            const imgSrc = img ? img.getAttribute('src') || img.getAttribute('data-src') : '';

            if (pinUrl) {
              results.push({ url: fullUrl, description, saves, imgSrc });
            }
          });
          return results.slice(0, 20);
        });

        console.log(`📊 "${kw}": ${pins.length}件`);
        pins.forEach(p => {
          p.keyword = kw;
          allPins.push(p);
        });

      } catch (e) {
        console.error(`❌ "${kw}" 失敗: ${e.message}`);
      }

      await sleep(3000);
    }

    return allPins;
  } finally {
    await browser.close();
  }
}

collectBuzz()
  .then(pins => {
    const result = {
      collectedAt: new Date().toISOString(),
      platform: 'pinterest',
      keywords: KEYWORDS,
      totalPins: pins.length,
      pins: pins.sort((a, b) => b.saves - a.saves),
      maxSaves: pins.reduce((m, p) => Math.max(m, p.saves), 0),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE} (${pins.length}件)`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'pinterest',
      error: err.message,
      pins: [],
      totalPins: 0,
      maxSaves: 0,
    }, null, 2));
    process.exit(1);
  });
