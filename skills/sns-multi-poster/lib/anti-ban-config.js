// SNS自動投稿 - BAN対策設定
// 作成日: 2026-02-21
// VPS運用でもBANリスクを最小化する設定

module.exports = {
  // レート制限（厳格）
  rateLimits: {
    instagram: {
      maxPostsPerHour: 3,      // 1時間3投稿（安全マージン）
      maxPostsPerDay: 20,      // 1日20投稿
      minDelayBetweenPosts: 15 * 60 * 1000, // 最低15分間隔
    },
    threads: {
      maxPostsPerHour: 4,
      maxPostsPerDay: 25,
      minDelayBetweenPosts: 12 * 60 * 1000,
    },
    facebook: {
      maxPostsPerHour: 5,
      maxPostsPerDay: 30,
      minDelayBetweenPosts: 10 * 60 * 1000,
    },
    pinterest: {
      maxPostsPerHour: 6,
      maxPostsPerDay: 50,
      minDelayBetweenPosts: 8 * 60 * 1000,
    },
    x: {
      maxPostsPerHour: 10,     // Xは比較的緩い
      maxPostsPerDay: 100,
      minDelayBetweenPosts: 5 * 60 * 1000,
    },
  },

  // ランダム遅延（秒）
  randomDelays: {
    beforeAction: { min: 2, max: 5 },      // 操作前
    afterAction: { min: 1, max: 3 },       // 操作後
    betweenClicks: { min: 0.5, max: 1.5 }, // クリック間
    typing: { min: 50, max: 150 },         // タイピング（ミリ秒/文字）
  },

  // 投稿時間制限（人間らしい時間帯のみ）
  allowedPostingHours: {
    start: 7,  // 朝7時から
    end: 23,   // 夜23時まで
  },

  // User-Agentローテーション（実際のブラウザ）
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  ],

  // ブラウザ設定（検出回避）
  browserArgs: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],

  // 検出回避設定
  antiDetection: {
    // navigator.webdriver を削除
    removeWebdriver: true,
    // Chrome Detection Test をパス
    overridePermissions: true,
    // Canvas/WebGL fingerprint対策
    randomizeFingerprint: false, // Level 2で有効化
  },
};
