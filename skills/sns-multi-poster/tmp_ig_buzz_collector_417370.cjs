const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const HASHTAGS = ['浮世絵', 'ukiyoe', 'japanart'];
const OUTPUT_FILE = process.argv[2];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function collectBuzz() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900'
    ]
  });

  const allPosts = [];

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    // Cookie読み込み
    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error(`Cookieファイルなし: ${COOKIES_PATH}`);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('🔐 Cookie設定完了');

    for (const tag of HASHTAGS) {
      console.log(`\n🔍 ハッシュタグ #${tag} を調査中...`);
      const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(3000);

        // ログイン確認
        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
          console.error('❌ ログイン必要 - Cookie期限切れの可能性');
          continue;
        }

        // Top投稿を取得（最初の9件）
        const posts = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article a[href*="/p/"]'));
          return articles.slice(0, 9).map(a => {
            const href = a.getAttribute('href') || '';
            const img = a.querySelector('img');
            return {
              url: `https://www.instagram.com${href}`,
              alt: img ? img.getAttribute('alt') || '' : '',
            };
          });
        });

        console.log(`📊 ${tag}: ${posts.length}件取得`);

        // 各投稿の詳細を取得（いいね数など）
        for (let i = 0; i < Math.min(posts.length, 5); i++) {
          const post = posts[i];
          try {
            await page.goto(post.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2000);

            const detail = await page.evaluate(() => {
              // いいね数
              const likeEl = document.querySelector('section > span > span, [aria-label*="いいね"], [href*="/liked_by/"]');
              let likes = 0;
              if (likeEl) {
                const match = (likeEl.textContent || '').match(/[\d,]+/);
                if (match) likes = parseInt(match[0].replace(/,/g, ''), 10);
              }

              // コメント数
              const commentEl = document.querySelector('h2 ~ div span, [aria-label*="コメント"]');
              let comments = 0;
              if (commentEl) {
                const match = (commentEl.textContent || '').match(/[\d,]+/);
                if (match) comments = parseInt(match[0].replace(/,/g, ''), 10);
              }

              // キャプション
              const captionEl = document.querySelector('h1, [class*="caption"]');
              const caption = captionEl ? captionEl.textContent.substring(0, 200) : '';

              return { likes, comments, caption };
            });

            allPosts.push({
              hashtag: '',  // filled below
              url: post.url,
              alt: post.alt,
              likes: detail.likes,
              comments: detail.comments,
              caption: detail.caption,
            });

            allPosts[allPosts.length - 1].hashtag = tag;
            console.log(`  ✅ ${post.url} → いいね:${detail.likes} コメント:${detail.comments}`);

          } catch (e) {
            console.log(`  ⚠️  詳細取得失敗: ${post.url} - ${e.message}`);
            allPosts.push({
              hashtag: tag,
              url: post.url,
              alt: post.alt,
              likes: 0,
              comments: 0,
              caption: '',
            });
          }

          await sleep(1500);
        }

        // 詳細を取得しなかった残りの投稿
        for (let i = 5; i < posts.length; i++) {
          allPosts.push({
            hashtag: tag,
            url: posts[i].url,
            alt: posts[i].alt,
            likes: 0,
            comments: 0,
            caption: '',
          });
        }

      } catch (e) {
        console.error(`❌ ${tag} 取得失敗: ${e.message}`);
      }

      await sleep(3000);
    }

    return allPosts;

  } finally {
    await browser.close();
  }
}

collectBuzz()
  .then(posts => {
    const result = {
      collectedAt: new Date().toISOString(),
      platform: 'instagram',
      hashtags: HASHTAGS,
      totalPosts: posts.length,
      posts: posts.sort((a, b) => b.likes - a.likes),
      topPost: posts.sort((a, b) => b.likes - a.likes)[0] || null,
      maxLikes: posts.reduce((max, p) => Math.max(max, p.likes), 0),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ 保存完了: ${OUTPUT_FILE}`);
    console.log(`📊 合計: ${posts.length}件 / 最高いいね: ${result.maxLikes}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 収集失敗:', err.message);
    // エラー時も空のJSONを作成
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      collectedAt: new Date().toISOString(),
      platform: 'instagram',
      error: err.message,
      posts: [],
      totalPosts: 0,
      maxLikes: 0,
    }, null, 2));
    process.exit(1);
  });
