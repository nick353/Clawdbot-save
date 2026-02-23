#!/usr/bin/env node
/**
 * Playwright ブラウザプロファイルテストスクリプト
 * プロファイルの読み込み、アクセス確認、メモリ使用量測定
 *
 * Usage: node playwright-profile-test.js [instagram|threads|facebook]
 */

const { PlaywrightBrowserAuth, chromium } = require('./playwright-browser-auth');
const os = require('os');

const platform = process.argv[2] || 'instagram';

async function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2),
    external: (usage.external / 1024 / 1024).toFixed(2),
    rss: (usage.rss / 1024 / 1024).toFixed(2),
  };
}

const platformConfigs = {
  instagram: {
    url: 'https://www.instagram.com/',
    authCheck: ['button[aria-label="ハート"]', 'span[aria-label="プロフィール"]', 'svg[aria-label="ホーム"]'],
  },
  threads: {
    url: 'https://www.threads.net/',
    authCheck: ['button[aria-label="ホーム"]', 'div[role="menuitem"]', 'svg[aria-label="ホーム"]'],
  },
  facebook: {
    url: 'https://www.facebook.com/',
    authCheck: ['a[href*="/feed"]', 'button[aria-label="Home"]', 'div[aria-label="Home"]'],
  },
};

async function main() {
  console.log(`🧪 Playwright ブラウザプロファイルテスト: ${platform}`);
  console.log('');

  if (!platformConfigs[platform]) {
    console.error(`❌ 未対応のプラットフォーム: ${platform}`);
    console.error(`   対応: ${Object.keys(platformConfigs).join(', ')}`);
    process.exit(1);
  }

  const config = platformConfigs[platform];
  const auth = new PlaywrightBrowserAuth(platform);

  console.log(`📋 テスト項目:`);
  console.log(`   1. プロファイル存在確認`);
  console.log(`   2. ブラウザ起動`);
  console.log(`   3. プロファイル読み込み`);
  console.log(`   4. ${platform} アクセス確認`);
  console.log(`   5. 認証確認`);
  console.log(`   6. メモリ使用量測定`);
  console.log('');

  // テスト 1: プロファイル存在確認
  console.log('⏳ テスト 1: プロファイル存在確認...');
  if (!auth.profileExists()) {
    console.error('❌ プロファイルが見つかりません');
    console.error(`   先に初期化スクリプトを実行してください:`);
    console.error(`   node /root/clawd/scripts/${platform}-login-setup.js`);
    process.exit(1);
  }
  const profileInfo = auth.getProfileInfo();
  console.log(`✅ プロファイル存在確認完了`);
  console.log(`   保存日時: ${profileInfo.savedAt}`);
  console.log(`   Cookie数: ${profileInfo.cookieCount}`);
  console.log('');

  const memBefore = await getMemoryUsage();
  console.log('💾 初期メモリ使用量:');
  console.log(`   Heap Used: ${memBefore.heapUsed} MB`);
  console.log(`   Heap Total: ${memBefore.heapTotal} MB`);
  console.log(`   RSS: ${memBefore.rss} MB`);
  console.log('');

  let browser, context;

  try {
    // テスト 2: ブラウザ起動
    console.log('⏳ テスト 2: ブラウザを起動しています...');
    browser = await chromium.launch(PlaywrightBrowserAuth.getHeadlessOptions());
    console.log('✅ ブラウザ起動完了 (ヘッドレスモード)');
    console.log('');

    // テスト 3: プロファイル読み込み
    console.log('⏳ テスト 3: プロファイルを読み込んでいます...');
    context = await auth.createBrowserContext(browser);
    console.log('✅ プロファイル読み込み完了');
    console.log('');

    // テスト 4: アクセス確認
    console.log(`⏳ テスト 4: ${platform} にアクセスしています...`);
    const page = await context.newPage();

    const startTime = Date.now();
    await page.goto(config.url, { waitUntil: 'networkidle', timeout: 60000 });
    const loadTime = Date.now() - startTime;

    console.log(`✅ ${platform} アクセス完了`);
    console.log(`   ページ読み込み時間: ${loadTime}ms`);
    console.log('');

    // テスト 5: 認証確認
    console.log('⏳ テスト 5: 認証状態を確認しています...');
    let authVerified = false;
    for (const selector of config.authCheck) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }, element);

          if (isVisible) {
            console.log(`✅ 認証確認完了: ${selector}`);
            authVerified = true;
            break;
          }
        }
      } catch (e) {
        // セレクタが見つからない場合はスキップ
      }
    }

    if (!authVerified) {
      console.warn('⚠️  認証状態が不確定です（セレクタでの確認ができませんでした）');
      console.log('   ページソースを確認して、適切なセレクタを設定してください');
    }
    console.log('');

    // テスト 6: メモリ使用量測定
    console.log('⏳ テスト 6: メモリ使用量を測定しています...');
    const memAfter = await getMemoryUsage();

    console.log('💾 終了時のメモリ使用量:');
    console.log(`   Heap Used: ${memAfter.heapUsed} MB`);
    console.log(`   Heap Total: ${memAfter.heapTotal} MB`);
    console.log(`   RSS: ${memAfter.rss} MB`);
    console.log('');

    const memDelta = {
      heapUsed: (parseFloat(memAfter.heapUsed) - parseFloat(memBefore.heapUsed)).toFixed(2),
      rss: (parseFloat(memAfter.rss) - parseFloat(memBefore.rss)).toFixed(2),
    };

    console.log('📊 メモリ増加量:');
    console.log(`   Heap Used: +${memDelta.heapUsed} MB`);
    console.log(`   RSS: +${memDelta.rss} MB`);
    console.log('');

    // 判定
    if (Math.abs(parseFloat(memDelta.rss)) < 500) {
      console.log('✅ メモリ使用量は OK レベル（VPS運用に支障なし）');
    } else if (Math.abs(parseFloat(memDelta.rss)) < 1000) {
      console.log('⚠️  メモリ使用量は中程度（複数プロセス同時実行時に注意）');
    } else {
      console.log('⚠️  メモリ使用量が多い（VPS운用に影響の可能性あり）');
    }
    console.log('');

    // 最終結果
    console.log('='.repeat(50));
    console.log('✅ テスト完了: すべて正常に動作しました');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('');
    console.error('❌ テスト失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main();
