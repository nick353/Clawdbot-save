#!/usr/bin/env node

/**
 * X(Twitter) 直接API検索スクリプト
 * Cookieを使ってXのGraphQL APIを直接呼び出し
 * 外部パッケージ不要（fetch使用）
 */

// Cookies
const AUTH_TOKEN = 'c41f221b78c39097420346a2346e9a6a9431e615';
const CT0 = 'd8fd50475309b3ec41072902857fff63c0e3f3985a039eec1be0278cd865e1a84f9edef2c8a2a51f9d8f47d702f508ecb50ec532fdadebeddecd38be025c24b87d6b0e6480ab0f2ac52b42548a978ec7';

// X GraphQL Search API endpoint
const SEARCH_ENDPOINT = 'https://x.com/i/api/graphql/NA567V_8AFwu0cZEkAAKcw/SearchTimeline';

async function searchX(query, count = 10) {
  const variables = {
    rawQuery: query,
    count: count,
    querySource: 'typed_query',
    product: 'Latest'
  };
  
  const features = {
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(features)
  });

  const url = `${SEARCH_ENDPOINT}?${params.toString()}`;

  const headers = {
    'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'Cookie': `auth_token=${AUTH_TOKEN}; ct0=${CT0}`,
    'X-Csrf-Token': CT0,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'X-Twitter-Active-User': 'yes',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'X-Twitter-Client-Language': 'en'
  };

  console.log('🔍 Searching X for:', query);
  console.log('📡 Calling X API...\n');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ API Error:', error.message);
    throw error;
  }
}

function extractTweets(data) {
  const tweets = [];
  
  try {
    const instructions = data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
    
    for (const instruction of instructions) {
      if (instruction.type === 'TimelineAddEntries') {
        for (const entry of instruction.entries || []) {
          if (entry.content?.itemContent?.tweet_results?.result) {
            const tweet = entry.content.itemContent.tweet_results.result;
            if (tweet.legacy) {
              tweets.push({
                id: tweet.rest_id,
                text: tweet.legacy.full_text,
                user: tweet.core?.user_results?.result?.legacy?.screen_name || 'unknown',
                name: tweet.core?.user_results?.result?.legacy?.name || 'Unknown',
                created_at: tweet.legacy.created_at,
                likes: tweet.legacy.favorite_count,
                retweets: tweet.legacy.retweet_count,
                replies: tweet.legacy.reply_count,
                has_media: (tweet.legacy.entities?.media?.length || 0) > 0
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Parse error:', error.message);
  }
  
  return tweets;
}

async function main() {
  const query = process.argv[2] || 'Clawdbot OR Moltbot';
  
  try {
    const data = await searchX(query, 20);
    const tweets = extractTweets(data);
    
    if (tweets.length === 0) {
      console.log('No tweets found. Cookies may be invalid or expired.');
      console.log('\n💡 Try getting fresh cookies from your browser.');
      return;
    }
    
    console.log(`✅ Found ${tweets.length} tweets:\n`);
    console.log('='.repeat(80) + '\n');
    
    tweets.forEach((tweet, i) => {
      console.log(`${i + 1}. @${tweet.user} (${tweet.name})`);
      console.log(`   📅 ${tweet.created_at}`);
      console.log(`   💬 ${tweet.text}`);
      console.log(`   ❤️  ${tweet.likes} likes | 🔁 ${tweet.retweets} retweets | 💬 ${tweet.replies} replies`);
      if (tweet.has_media) {
        console.log(`   📷 Has media`);
      }
      console.log(`   🔗 https://x.com/${tweet.user}/status/${tweet.id}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log('✅ Search completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Tips:');
    console.error('  - Cookies may have expired');
    console.error('  - Get fresh cookies from your browser (F12 → Application → Cookies)');
    process.exit(1);
  }
}

main();
