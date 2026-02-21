const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/threads.json';
const IG_COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const OUTPUT_FILE = process.argv[2];
const PROFILE_URL = 'https://www.threads.net/@nisen_prints';

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

    // Cookie読み込み
    let cookiesPath = fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : IG_COOKIES_PATH;
    if (!fs.existsSync(cookiesPath)) {
      throw new Error(`Cookieファイルなし: ${cookiesPath}`);
    }
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies);
    console.log(`🔐 Cookie設定完了: ${cookiesPath}`);

    console.log(`🌐 プロフィールページアクセス: ${PROFILE_URL}`);
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('ログイン必要 - Cookie期限切れ');
    }

    // スクロールして投稿を読み込む
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await sleep(1500);
    }

    const posts = await page.evaluate(() => {
      const results = [];
      const postEls = document.querySelectorAll('article, [data-pressable-container="true"]');

      postEls.forEach(el => {
        const textEl = el.querySelector('span[dir="auto"], p');
        const text = textEl ? textEl.textContent.substring(0, 200) : '';

        const link = el.querySelector('a[href*="/post/"]');
        const url = link ? `https://www.threads.net${link.getAttribute('href')}` : '';

        // エンゲージメント数値
        const spans = el.querySelectorAll('span[title], span[aria-label]');
        let likes = 0, replies = 0, reposts = 0;
        spans.forEach(s => {
          const label = (s.getAttribute('aria-label') || s.getAttribute('title') || '').toLowerCase();
          const val = parseInt((s.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
          if (label.includes('like') || label.includes('いいね')) likes = val;
          else if (label.includes('repl') || label.includes('返信')) replies = val;
          else if (label.includes('repost') || label.includes('リポスト')) reposts = val;
        });

        if (text.length > 3 || url) {
          results.push({ text, url, likes, replies, reposts });
        }
      });

      return results.slice(0, 10);
    });

    console.log(`📊 取得投稿数: ${posts.length}件`);
    return posts;

  } finally {
    await browser.close();
  }
}

collectPerformance()
  .then(posts => {
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const result = {
      collectedAt: new Date().toISOString(),
      platform: 'threads',
      account: 'nisen_prints',
      totalPosts: posts.length,
      totalLikes,
      avgLikes: posts.length > 0 ? Math.round(totalLikes / posts.length) : 0,
      maxLikes: posts.reduce((m, p) => Math.max(m, p.likes), 0),
      posts,
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE}`);
    console.log(`📊 ${posts.length}件 / 平均いいね: ${result.avgLikes}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'threads',
      error: err.message,
      posts: [],
      totalPosts: 0,
    }, null, 2));
    process.exit(1);
  });
