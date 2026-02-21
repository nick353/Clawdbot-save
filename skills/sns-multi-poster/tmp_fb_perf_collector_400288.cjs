const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/facebook.json';
const OUTPUT_FILE = process.argv[2];
// nisen_printsのFacebookページURL（実際のURLに合わせて変更）
const PROFILE_URL = 'https://www.facebook.com/nisen_prints';

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
    console.log('🔐 Facebook Cookie設定完了');

    console.log(`🌐 Facebookページアクセス: ${PROFILE_URL}`);
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('ログイン必要 - Cookie期限切れ');
    }

    // スクロールして投稿を読み込む
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await sleep(1500);
    }

    const posts = await page.evaluate(() => {
      const results = [];
      const feedItems = document.querySelectorAll('[data-pagelet*="FeedUnit"], [role="article"]');

      feedItems.forEach(item => {
        const textEl = item.querySelector('[data-ad-comet-preview="message"], [data-testid="post_message"], div[dir="auto"] span');
        const text = textEl ? textEl.textContent.substring(0, 200) : '';

        const linkEl = item.querySelector('a[href*="/posts/"], a[href*="story_fbid"], a[href*="/permalink/"]');
        const url = linkEl ? linkEl.getAttribute('href') : '';

        // リアクション数
        const reactionEl = item.querySelector('[aria-label*="reaction"], span[class*="count"]');
        let likes = 0;
        if (reactionEl) {
          const m = (reactionEl.textContent || '').match(/[\d,.]+/);
          if (m) likes = parseInt(m[0].replace(/[,.]/g, ''), 10);
        }

        // コメント数
        const commentEl = item.querySelector('[aria-label*="comment"]');
        let comments = 0;
        if (commentEl) {
          const m = (commentEl.getAttribute('aria-label') || '').match(/[\d]+/);
          if (m) comments = parseInt(m[0], 10);
        }

        // シェア数
        const shareEl = item.querySelector('[aria-label*="share"]');
        let shares = 0;
        if (shareEl) {
          const m = (shareEl.getAttribute('aria-label') || '').match(/[\d]+/);
          if (m) shares = parseInt(m[0], 10);
        }

        if (text.length > 3 || url) {
          results.push({ text, url, likes, comments, shares });
        }
      });

      return results.slice(0, 7);
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
      platform: 'facebook',
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
      platform: 'facebook',
      error: err.message,
      posts: [],
      totalPosts: 0,
    }, null, 2));
    process.exit(1);
  });
