#!/usr/bin/env node
/**
 * Google検索スクリプト - Puppeteer版
 * 
 * 使い方:
 *   node search-google.js "検索キーワード"
 */

const puppeteer = require('puppeteer');

async function searchGoogle(query) {
  console.log(`🔍 Google検索開始: "${query}"`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // User-Agent設定（ボット検出回避）
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Google検索ページにアクセス
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;
    console.log(`📂 URL: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // ページが読み込まれるまで待機
    await page.waitForTimeout(2000);
    
    // 検索結果を抽出
    const results = await page.evaluate(() => {
      const items = [];
      
      // Google検索結果のセレクタ（複数パターン対応）
      const searchResults = document.querySelectorAll('div.g, div[data-sokoban-container]');
      
      searchResults.forEach((result, index) => {
        if (index >= 10) return; // 最初の10件のみ
        
        try {
          // タイトル（複数セレクタ試行）
          let title = '';
          const titleSelectors = ['h3', '.LC20lb', '[role="heading"]'];
          for (const selector of titleSelectors) {
            const titleEl = result.querySelector(selector);
            if (titleEl) {
              title = titleEl.textContent.trim();
              break;
            }
          }
          
          // URL
          const linkEl = result.querySelector('a[href^="http"], a[href^="/url"]');
          let url = linkEl ? linkEl.href : '';
          
          // /url?q= 形式の場合は実際のURLを抽出
          if (url.includes('/url?')) {
            try {
              const urlParams = new URLSearchParams(url.split('?')[1]);
              url = urlParams.get('q') || url;
            } catch (e) {}
          }
          
          // スニペット（説明文）
          let snippet = '';
          const snippetSelectors = ['.VwiC3b', '.lEBKkf', '.s', '[data-content-feature="1"]'];
          for (const selector of snippetSelectors) {
            const snippetEl = result.querySelector(selector);
            if (snippetEl) {
              snippet = snippetEl.textContent.trim();
              break;
            }
          }
          
          if (title && url && url.startsWith('http')) {
            items.push({ title, url, snippet });
          }
        } catch (e) {
          // エラーは無視
        }
      });
      
      return items;
    });
    
    // 結果を表示
    console.log(`\n✅ ${results.length}件の検索結果を取得\n`);
    
    results.forEach((item, index) => {
      console.log(`--- 検索結果 ${index + 1} ---`);
      console.log(`📌 ${item.title}`);
      console.log(`🔗 ${item.url}`);
      if (item.snippet) {
        console.log(`📝 ${item.snippet.substring(0, 150)}${item.snippet.length > 150 ? '...' : ''}`);
      }
      console.log('');
    });
    
    // JSON出力
    if (process.argv.includes('--json')) {
      console.log('\n--- JSON出力 ---');
      console.log(JSON.stringify(results, null, 2));
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// コマンドライン引数から検索キーワードを取得
const query = process.argv[2];

if (!query) {
  console.error('使い方: node search-google.js "検索キーワード"');
  process.exit(1);
}

// 実行
searchGoogle(query).catch(error => {
  console.error('検索失敗:', error);
  process.exit(1);
});
