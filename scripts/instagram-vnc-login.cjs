#!/usr/bin/env node

/**
 * Instagram VNC ブラウザログインスクリプト
 * 用途: VNC経由でVPS上からInstagramへのブラウザログインをリモート操作
 * 機能:
 *   - Playwright headful モード (GUI ブラウザで操作)
 *   - OTP/2FA 入力待機
 *   - Cookies 自動保存
 *   - 接続タイムアウト設定
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 設定
const CONFIG = {
    instagramUrl: 'https://www.instagram.com/',
    cookiesDir: '/root/clawd/cookies',
    cookiesFile: '/root/clawd/cookies/instagram.json',
    headless: false, // headful モード有効
    timeout: 120000, // 2分
    slowMo: 100, // スローモーション (ミリ秒)
    viewport: {
        width: 1920,
        height: 1080,
    },
};

// ログ関数
const log = {
    info: (msg) => console.log(`[ℹ️  INFO] ${msg}`),
    success: (msg) => console.log(`[✅ SUCCESS] ${msg}`),
    error: (msg) => console.error(`[❌ ERROR] ${msg}`),
    warn: (msg) => console.log(`[⚠️  WARN] ${msg}`),
};

/**
 * ディレクトリが存在しなければ作成
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log.info(`ディレクトリを作成しました: ${dir}`);
    }
}

/**
 * Cookies を保存
 */
async function saveCookies(context) {
    try {
        const cookies = await context.cookies();
        ensureDir(CONFIG.cookiesDir);
        fs.writeFileSync(CONFIG.cookiesFile, JSON.stringify(cookies, null, 2));
        log.success(`Cookies を保存しました: ${CONFIG.cookiesFile}`);
    } catch (err) {
        log.error(`Cookies 保存に失敗: ${err.message}`);
    }
}

/**
 * 保存済みの Cookies を読み込む
 */
function loadCookies() {
    try {
        if (fs.existsSync(CONFIG.cookiesFile)) {
            const cookies = JSON.parse(fs.readFileSync(CONFIG.cookiesFile, 'utf-8'));
            log.info(`${cookies.length} 個の Cookies を読み込みました`);
            return cookies;
        }
    } catch (err) {
        log.warn(`Cookies の読み込みに失敗: ${err.message}`);
    }
    return [];
}

/**
 * ユーザー入力を待機（OTP/2FA コード入力用）
 */
function promptUser(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Instagram ログイン処理
 */
async function loginToInstagram() {
    let browser, context, page;

    try {
        // Playwright を起動
        log.info('Playwright を起動中 (headful モード)...');
        browser = await chromium.launch({
            headless: CONFIG.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
            ],
        });

        // コンテキスト作成
        context = await browser.newContext({
            viewport: CONFIG.viewport,
            locale: 'en-US',
            timezoneId: 'UTC',
        });

        // 既存の Cookies を読み込む
        const savedCookies = loadCookies();
        if (savedCookies.length > 0) {
            await context.addCookies(savedCookies);
            log.info('保存済み Cookies を復元しました');
        }

        // ページを開く
        page = await context.newPage();
        page.setDefaultTimeout(CONFIG.timeout);
        page.setDefaultNavigationTimeout(CONFIG.timeout);

        log.info(`Instagram にアクセス中: ${CONFIG.instagramUrl}`);
        await page.goto(CONFIG.instagramUrl, { waitUntil: 'networkidle' });

        // ログイン状態の確認
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        
        if (currentUrl.includes('/accounts/login')) {
            log.info('ログインページが表示されました');
            log.info('===== 以下の手順に従ってください =====');
            log.info('1. ブラウザの画面でInstagramにログインしてください');
            log.info('2. OTP/2FAが要求された場合は入力してください');
            log.info('3. ログイン後、「Enter キーを押す」と表示されたら Enter を押してください');
            log.info('======================================');

            // ユーザーの確認を待機
            await promptUser('\n✋ ログイン完了後、Enter キーを押してください: ');

            // ページの遷移を確認
            await page.waitForURL('**/feed/**', { timeout: CONFIG.timeout }).catch(() => {
                log.warn('フィードページが見つかりませんでした。手動で操作してください');
            });
        } else if (currentUrl.includes('/feed')) {
            log.success('既にログイン済みです (Cookies から復元)');
        } else {
            log.warn(`予期しないページが表示されました: ${currentUrl}`);
            log.info('ブラウザの指示に従ってログインしてください');
            await promptUser('\n✋ 操作完了後、Enter キーを押してください: ');
        }

        // Cookies を保存
        await saveCookies(context);

        // 最終確認
        const finalUrl = page.url();
        if (finalUrl.includes('/feed') || finalUrl.includes('/')) {
            log.success('✅ Instagram ログインが完了しました！');
            log.success('Cookies は以下に保存されました:');
            log.success(`  ${CONFIG.cookiesFile}`);
            log.info('このスクリプトは 30 秒後に終了します...');
            
            // 30秒待機（ユーザーがブラウザを操作できるようにする）
            await page.waitForTimeout(30000);
        }

    } catch (err) {
        log.error(`エラーが発生しました: ${err.message}`);
        log.info('スタックトレース:');
        console.error(err);
    } finally {
        if (browser) {
            log.info('ブラウザを終了しています...');
            await browser.close();
        }
    }
}

/**
 * メイン処理
 */
async function main() {
    log.info('================================================');
    log.info('Instagram VNC ブラウザログインスクリプト');
    log.info(`DISPLAY: ${process.env.DISPLAY || ':99'}`);
    log.info('================================================');

    // DISPLAY が設定されているか確認
    if (!process.env.DISPLAY) {
        log.warn('DISPLAY 環境変数が設定されていません');
        log.info('セットアップスクリプトから実行してください');
        log.info('例: bash /root/clawd/scripts/setup-vnc-instagram-login.sh start');
        process.exit(1);
    }

    await loginToInstagram();
}

main().catch((err) => {
    log.error(`致命的エラー: ${err.message}`);
    process.exit(1);
});
