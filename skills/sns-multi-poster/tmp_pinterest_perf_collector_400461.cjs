const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/pinterest.json';
const OUTPUT_FILE = process.argv[2];
const PROFILE_URL = 'https://www.pinterest.com/nisen_prints/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function collectPerformance() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error(`Cookieファイルなし: ${COOKIES_PATH}`);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('🔐 Pinterest Cookie設定完了');

    console.log(`🌐 プロフィールアクセス: ${PROFILE_URL}`);
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('ログイン必要 - Cookie期限切れ');
    }

    // スクロールして追加読み込み
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await sleep(1500);
    }

    const pins = await page.evaluate(() => {
      const results = [];
      const pinEls = document.querySelectorAll('[data-test-id="pin"], div[class*="Pin"]');

      pinEls.forEach(pin => {
        const img = pin.querySelector('img');
        const link = pin.querySelector('a[href*="/pin/"]');
        const descEl = pin.querySelector('[data-test-id="pin-visual-title"], span, p');

        const pinUrl = link ? link.getAttribute('href') : '';
        const fullUrl = pinUrl.startsWith('http') ? pinUrl : `https://www.pinterest.com${pinUrl}`;
        const description = descEl ? descEl.textContent.substring(0, 200) : '';
        const imgSrc = img ? (img.getAttribute('src') || img.getAttribute('srcset') || '') : '';

        // 保存数（ピンページを開かないと取れないことが多い）
        const saveEl = pin.querySelector('[aria-label*="save"], [aria-label*="保存"], [class*="save-count"]');
        let saves = 0;
        if (saveEl) {
          const m = (saveEl.textContent || saveEl.getAttribute('aria-label') || '').match(/[\d,]+/);
          if (m) saves = parseInt(m[0].replace(/,/g, ''), 10);
        }

        if (pinUrl) {
          results.push({ url: fullUrl, description, saves, imgSrc: imgSrc.split(' ')[0] });
        }
      });

      return results.slice(0, 10);
    });

    console.log(`📊 取得ピン数: ${pins.length}件`);

    // 各ピンの詳細（保存数）を取得
    for (let i = 0; i < Math.min(pins.length, 5); i++) {
      const pin = pins[i];
      if (!pin.url || pin.saves > 0) continue;

      try {
        await page.goto(pin.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);

        const detail = await page.evaluate(() => {
          const saveEl = document.querySelector('[data-test-id="save-count"], [aria-label*="save"], span[class*="count"]');
          let saves = 0;
          if (saveEl) {
            const m = (saveEl.textContent || '').match(/[\d,]+/);
            if (m) saves = parseInt(m[0].replace(/,/g, ''), 10);
          }

          const descEl = document.querySelector('[data-test-id="pin-description"], div[class*="description"]');
          const description = descEl ? descEl.textContent.substring(0, 300) : '';

          return { saves, description };
        });

        pins[i].saves = detail.saves;
        if (detail.description) pins[i].description = detail.description;
        console.log(`  ✅ ${pin.url} → 保存:${detail.saves}`);

      } catch (e) {
        console.log(`  ⚠️  詳細取得失敗: ${e.message}`);
      }

      await sleep(2000);
    }

    return pins;
  } finally {
    await browser.close();
  }
}

collectPerformance()
  .then(pins => {
    const result = {
      collectedAt: new Date().toISOString(),
      platform: 'pinterest',
      account: 'nisen_prints',
      totalPins: pins.length,
      maxSaves: pins.reduce((m, p) => Math.max(m, p.saves), 0),
      avgSaves: pins.length > 0 ? Math.round(pins.reduce((s, p) => s + p.saves, 0) / pins.length) : 0,
      pins: pins.sort((a, b) => b.saves - a.saves),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE}`);
    console.log(`📊 ${pins.length}件 / 最高保存: ${result.maxSaves}`);
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
    }, null, 2));
    process.exit(1);
  });
