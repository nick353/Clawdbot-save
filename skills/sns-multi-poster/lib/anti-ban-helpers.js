// SNS自動投稿 - BAN対策ヘルパー関数
// 作成日: 2026-02-21

const fs = require('fs');
const path = require('path');
const config = require('./anti-ban-config.js');

// レート制限チェック用のログファイルパス
const RATE_LIMIT_LOG = '/root/clawd/data/sns-posts/rate-limit-log.json';

// ランダム遅延
const randomDelay = (min, max) => {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
};

// ランダムUser-Agent取得
const getRandomUserAgent = () => {
  const agents = config.userAgents;
  return agents[Math.floor(Math.random() * agents.length)];
};

// 投稿時間チェック（深夜投稿を避ける） - JST（UTC+9）で判定
const isAllowedPostingTime = () => {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  const hour = jstTime.getUTCHours(); // JSTの時刻を取得
  const { start, end } = config.allowedPostingHours;
  
  if (hour < start || hour >= end) {
    console.warn(`⚠️ 現在の時間（JST ${hour}時）は投稿禁止時間帯です（${start}時〜${end}時のみ許可）`);
    return false;
  }
  return true;
};

// レート制限チェック
const checkRateLimit = async (platform) => {
  try {
    // ログファイル読み込み
    let log = {};
    if (fs.existsSync(RATE_LIMIT_LOG)) {
      log = JSON.parse(fs.readFileSync(RATE_LIMIT_LOG, 'utf8'));
    }

    const now = Date.now();
    const limits = config.rateLimits[platform];
    
    if (!log[platform]) {
      log[platform] = { posts: [] };
    }

    // 古いログ削除（24時間以上前）
    log[platform].posts = log[platform].posts.filter(
      timestamp => now - timestamp < 24 * 60 * 60 * 1000
    );

    // 1時間以内の投稿数チェック
    const postsInLastHour = log[platform].posts.filter(
      timestamp => now - timestamp < 60 * 60 * 1000
    ).length;

    if (postsInLastHour >= limits.maxPostsPerHour) {
      console.error(`🚨 レート制限超過: ${platform} - 1時間以内に${postsInLastHour}投稿（上限: ${limits.maxPostsPerHour}）`);
      return false;
    }

    // 24時間以内の投稿数チェック
    const postsInLastDay = log[platform].posts.length;
    if (postsInLastDay >= limits.maxPostsPerDay) {
      console.error(`🚨 レート制限超過: ${platform} - 24時間以内に${postsInLastDay}投稿（上限: ${limits.maxPostsPerDay}）`);
      return false;
    }

    // 最後の投稿からの経過時間チェック
    if (log[platform].posts.length > 0) {
      const lastPost = Math.max(...log[platform].posts);
      const timeSinceLastPost = now - lastPost;
      
      if (timeSinceLastPost < limits.minDelayBetweenPosts) {
        const waitMinutes = Math.ceil((limits.minDelayBetweenPosts - timeSinceLastPost) / 60000);
        console.error(`⏳ 投稿間隔不足: ${platform} - あと${waitMinutes}分待ってください`);
        return false;
      }
    }

    // レート制限OK
    return true;
  } catch (error) {
    console.error('レート制限チェックエラー:', error);
    return true; // エラー時は投稿を許可（安全側）
  }
};

// 投稿ログ記録
const logPost = async (platform) => {
  try {
    let log = {};
    if (fs.existsSync(RATE_LIMIT_LOG)) {
      log = JSON.parse(fs.readFileSync(RATE_LIMIT_LOG, 'utf8'));
    }

    if (!log[platform]) {
      log[platform] = { posts: [] };
    }

    log[platform].posts.push(Date.now());

    // ディレクトリ作成
    const dir = path.dirname(RATE_LIMIT_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(RATE_LIMIT_LOG, JSON.stringify(log, null, 2));
    console.log(`✅ 投稿ログ記録: ${platform}`);
  } catch (error) {
    console.error('投稿ログ記録エラー:', error);
  }
};

// 人間らしいタイピング
const humanType = async (page, selector, text) => {
  await page.click(selector);
  await randomDelay(500, 1000);
  
  for (const char of text) {
    await page.keyboard.type(char);
    const { min, max } = config.randomDelays.typing;
    await randomDelay(min, max);
  }
};

// navigator.webdriver 削除
const removeWebdriverFlag = async (page) => {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
};

// Chrome Detection Test 対策
const bypassChromeDetection = async (page) => {
  await page.evaluateOnNewDocument(() => {
    // navigator.webdriver 削除
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Chrome オブジェクト偽装
    window.navigator.chrome = {
      runtime: {},
    };

    // Permissions 偽装
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Plugins 偽装
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Languages 偽装
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
};

module.exports = {
  randomDelay,
  getRandomUserAgent,
  isAllowedPostingTime,
  checkRateLimit,
  logPost,
  humanType,
  removeWebdriverFlag,
  bypassChromeDetection,
  config,
};
