const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const PROFILE_URL = 'https://www.instagram.com/nisen_prints/';

async function collectPerformance() {
  console.log('🚀 Puppeteer起動...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Cookie読み込み
    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error(`Cookieファイルが見つかりません: ${COOKIES_PATH}`);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('🔐 Cookie設定完了');
    
    // プロフィールページにアクセス
    console.log(`📂 プロフィールページアクセス: ${PROFILE_URL}`);
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // ログイン確認
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('[data-testid="login-form"]') && 
             !window.location.href.includes('/accounts/login/');
    });
    
    if (!isLoggedIn) {
      throw new Error('ログインされていません。Cookieを更新してください。');
    }
    console.log('✅ ログイン確認OK');
    
    // 投稿一覧を取得（記事リンク）
    console.log('📊 投稿一覧取得中...');
    await new Promise(r => setTimeout(r, 2000));
    
    // 投稿のURLリストを取得
    const postLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
      return [...new Set(links.map(l => l.href))].slice(0, 10);
    });
    
    console.log(`📝 投稿数: ${postLinks.length}`);
    
    if (postLinks.length === 0) {
      // スクリーンショット保存してデバッグ
      await page.screenshot({ path: '/tmp/instagram_perf_debug.png' });
      throw new Error('投稿が見つかりません。スクリーンショット: /tmp/instagram_perf_debug.png');
    }
    
    const results = [];
    
    // 各投稿のパフォーマンスデータを取得（最大10件）
    for (let i = 0; i < Math.min(postLinks.length, 10); i++) {
      const postUrl = postLinks[i];
      console.log(`📊 [${i+1}/${Math.min(postLinks.length, 10)}] 取得中: ${postUrl}`);
      
      try {
        await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const postData = await page.evaluate((url) => {
          // いいね数取得（複数のセレクタを試す）
          let likes = 0;
          let comments = 0;
          
          // いいね数: section内のspan, または "likes" を含むテキスト
          const likeSelectors = [
            'span[class*="Lm6oo"]',  // 一般的なクラス
            'section span span',
            'button[class*="pdR"] ~ span span',
          ];
          
          for (const sel of likeSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              const text = el.textContent.trim();
              const num = parseInt(text.replace(/[,、]/g, '').replace(/[^0-9]/g, ''));
              if (!isNaN(num) && num > 0) {
                likes = num;
                break;
              }
            }
          }
          
          // いいね数: テキスト検索
          if (likes === 0) {
            const allSpans = document.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent.trim();
              if (text.match(/^[0-9,]+$/) && !text.includes('.')) {
                const num = parseInt(text.replace(/,/g, ''));
                if (num > 0 && num < 1000000) {
                  likes = num;
                  break;
                }
              }
            }
          }
          
          // コメント数取得（ul内のliを数える）
          const commentItems = document.querySelectorAll('ul[class*="Mr508"] li, ul[class*="WVfde"] li');
          comments = commentItems.length;
          
          // 画像URL取得
          const imgEl = document.querySelector('article img[class*="x5yr21d"]') || 
                        document.querySelector('article img');
          const imgSrc = imgEl ? imgEl.src : '';
          
          // キャプション取得
          const captionEl = document.querySelector('h1[class*="_aagv"]') || 
                            document.querySelector('div[class*="_a9zs"] span');
          const caption = captionEl ? captionEl.textContent.trim().substring(0, 200) : '';
          
          return { url, likes, comments, caption, imgSrc };
        }, postUrl);
        
        results.push({
          ...postData,
          checked_at: new Date().toISOString()
        });
        
        console.log(`  ❤️ いいね: ${postData.likes} | 💬 コメント: ${postData.comments}`);
        
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`  ❌ 取得失敗: ${err.message}`);
        results.push({
          url: postUrl,
          likes: 0,
          comments: 0,
          error: err.message,
          checked_at: new Date().toISOString()
        });
      }
    }
    
    return results;
    
  } finally {
    await browser.close();
  }
}

collectPerformance()
  .then(results => {
    console.log(`\n✅ データ収集完了: ${results.length}件`);
    console.log(JSON.stringify(results, null, 2));
  })
  .catch(err => {
    console.error(`❌ エラー: ${err.message}`);
    console.log(JSON.stringify({ error: err.message, results: [] }, null, 2));
    process.exit(1);
  });
