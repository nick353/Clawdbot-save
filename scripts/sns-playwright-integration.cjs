#!/usr/bin/env node
/**
 * SNS Playwright 統合管理スクリプト
 * 既存の Cookie 認証と Playwright プロファイル認証を自動切り替え
 *
 * Usage: node sns-playwright-integration.js <platform> <operation> [args...]
 * Examples:
 *   node sns-playwright-integration.js instagram post <image> <caption>
 *   node sns-playwright-integration.js threads post <text> [image]
 *   node sns-playwright-integration.js facebook post <text> [image]
 *   node sns-playwright-integration.js instagram status
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// 設定
const PLATFORMS = {
  instagram: {
    setupScript: '/root/clawd/scripts/instagram-login-setup.js',
    postScript: '/root/clawd/skills/sns-multi-poster/post-to-instagram-playwright.cjs',
    fallbackScript: '/root/clawd/skills/sns-multi-poster/post-to-instagram-v5.cjs',
    profileDir: '/root/clawd/browser-profiles/instagram',
  },
  threads: {
    setupScript: '/root/clawd/scripts/threads-login-setup.js',
    postScript: '/root/clawd/skills/sns-multi-poster/post-to-threads-playwright.cjs',
    fallbackScript: '/root/clawd/skills/sns-multi-poster/post-to-threads-v2-anti-ban.cjs',
    profileDir: '/root/clawd/browser-profiles/threads',
  },
  facebook: {
    setupScript: '/root/clawd/scripts/facebook-login-setup.js',
    postScript: '/root/clawd/skills/sns-multi-poster/post-to-facebook-playwright.cjs',
    fallbackScript: '/root/clawd/skills/sns-multi-poster/post-to-facebook.cjs',
    profileDir: '/root/clawd/browser-profiles/facebook',
  },
};

const [, , platform, operation, ...args] = process.argv;

if (!platform || !operation) {
  console.error('使い方: node sns-playwright-integration.js <platform> <operation> [args...]');
  console.error('');
  console.error('プラットフォーム: instagram, threads, facebook');
  console.error('操作:');
  console.error('  status    - プロファイル状態確認');
  console.error('  setup     - プロファイル初期化');
  console.error('  test      - プロファイルテスト');
  console.error('  post      - 投稿実行（プロファイル自動選択）');
  process.exit(1);
}

if (!PLATFORMS[platform]) {
  console.error(`❌ 未対応のプラットフォーム: ${platform}`);
  console.error(`   対応: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(1);
}

const config = PLATFORMS[platform];

/**
 * プロファイル存在確認
 */
function hasProfile() {
  const statePath = path.join(config.profileDir, 'browser-state.json');
  const cookiesPath = path.join(config.profileDir, 'cookies.json');
  return fs.existsSync(statePath) && fs.existsSync(cookiesPath);
}

/**
 * プロファイル情報取得
 */
function getProfileInfo() {
  const metadataPath = path.join(config.profileDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

/**
 * 実行コマンド
 */
function run(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`▶️  ${cmd}`);
    exec(cmd, { cwd: '/root/clawd' }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * メイン処理
 */
async function main() {
  try {
    switch (operation) {
      case 'status':
        console.log(`📊 ${platform} プロファイル状態`);
        console.log('');
        if (hasProfile()) {
          const info = getProfileInfo();
          console.log('✅ プロファイルが存在します');
          console.log(`   保存日時: ${info.savedAt}`);
          console.log(`   Cookie数: ${info.cookieCount}`);
          console.log(`   保存先: ${config.profileDir}`);
        } else {
          console.log('❌ プロファイルが見つかりません');
          console.log(`   初期化コマンド: node sns-playwright-integration.js ${platform} setup`);
        }
        break;

      case 'setup':
        console.log(`🔧 ${platform} プロファイルを初期化します`);
        console.log('');
        await run(`node ${config.setupScript}`);
        break;

      case 'test':
        console.log(`🧪 ${platform} プロファイルをテストします`);
        console.log('');
        if (!hasProfile()) {
          console.error('❌ プロファイルが見つかりません');
          console.error(`   先に初期化してください: node sns-playwright-integration.js ${platform} setup`);
          process.exit(1);
        }
        await run(`node /root/clawd/scripts/playwright-profile-test.js ${platform}`);
        break;

      case 'post': {
        console.log(`📮 ${platform} に投稿します`);
        console.log('');

        if (!hasProfile()) {
          console.warn(`⚠️  プロファイルが見つかりません`);
          console.warn(`   初期化を推奨: node sns-playwright-integration.js ${platform} setup`);
          console.warn(`   フォールバック認証を使用します`);
          console.log('');

          // Cookie フォールバック
          const fallbackCmd = `node ${config.fallbackScript} ${args.join(' ')}`;
          await run(fallbackCmd);
        } else {
          // Playwright プロファイルを使用
          const postCmd = `node ${config.postScript} ${args.join(' ')}`;
          await run(postCmd);
        }
        break;
      }

      default:
        console.error(`❌ 未対応の操作: ${operation}`);
        console.error('   対応: status, setup, test, post');
        process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
