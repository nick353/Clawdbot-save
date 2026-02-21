#!/usr/bin/env node

/**
 * 簡易X(Twitter)検索スクリプト
 * Brave Search APIを使ってX投稿を検索
 */

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || 'BSAp8X7SVzTMnT9ANA1kXym4SHJCEGE';

async function searchX(query, limit = 10) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query + ' site:x.com OR site:twitter.com')}&count=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.web?.results || [];
}

async function main() {
  const query = process.argv[2] || 'Clawdbot OR Moltbot';
  console.log(`🔍 Searching X for: ${query}\n`);

  try {
    const results = await searchX(query, 15);
    
    if (results.length === 0) {
      console.log('No results found.');
      return;
    }

    console.log(`📊 Found ${results.length} results:\n`);
    
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   ${result.description || '(no description)'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
