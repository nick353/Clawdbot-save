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

        // 既存の Cookies をクリア（デバッグ用）
        // 一度保存されたCookiesが古い場合、ログインフローに入らないことがあるため
        log.info('古い Cookies をクリアしています...');
        
        const savedCookies = loadCookies();
        if (savedCookies.length > 0) {
            // Cookies を復元するのではなく、ログインフロー開始時には消す
            log.info(`${savedCookies.length} 個の古い Cookies が見つかりましたが、新規ログイン用にクリアします`);
        }

        // ページを開く
        page = await context.newPage();
        page.setDefaultTimeout(CONFIG.timeout);
        page.setDefaultNavigationTimeout(CONFIG.timeout);

        log.info(`Instagram にアクセス中: ${CONFIG.instagramUrl}`);
        await page.goto(CONFIG.instagramUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        log.success('✅ Instagramホームページに到達しました！');
        log.info('');
        log.info('===== VNC経由で以下の手順に従ってください =====');
        log.info('1. VNCでブラウザ画面を確認してください');
        log.info('2. 画面上の「Log in」ボタンをクリック（見つからない場合はスキップ）');
        log.info('3. Instagramのメールアドレス/ユーザー名を入力します');
        log.info('4. パスワードを入力します');
        log.info('5. OTP/2FAが要求されたら入力してください');
        log.info('6. ログイン完了後、ターミナルで Enter キーを押してください');
        log.info('================================================');
        log.info('');

        // ユーザーの確認を待機
        await promptUser('✋ ログイン完了後、Enter キーを押してください: ');

        // ページの遷移を確認
        let finalUrl = page.url();
        log.info(`最終URL: ${finalUrl}`);

        // ログイン成功の判定（複数パターン対応）
        if (finalUrl.includes('/feed/') || finalUrl.includes('/accounts/') || finalUrl !== CONFIG.instagramUrl) {
            log.success('✅ ページが変更されました（ログイン成功と判定）');
        } else {
            log.info('URL変更なし。VNCで画面を確認してください');
        }

        // Cookies を保存
        await saveCookies(context);

        log.success('✅ Instagram ログインが完了しました！');
        log.success('Cookies は以下に保存されました:');
        log.success(`  ${CONFIG.cookiesFile}`);
        log.info('ブラウザは 60 秒後に自動終了します...');
        
        // 60秒待機（ユーザーがブラウザを操作できるようにする）
        await page.waitForTimeout(60000);

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
