#!/usr/bin/env node

/**
 * SNS Browser Login Runner (CommonJS)
 * 各SNS対応の統一ログインロジック
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Color codes
const colors = {
    red: '\x1b[0;31m',
    green: '\x1b[0;32m',
    yellow: '\x1b[1;33m',
    blue: '\x1b[0;34m',
    reset: '\x1b[0m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
    step: (msg) => console.log(`\n${colors.blue}${msg}${colors.reset}`)
};

/**
 * ユーザー入力の読み込み
 */
function question(prompt) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * メイン処理
 */
async function main() {
    try {
        // 環境変数から設定を取得
        const snsName = process.env.SNS_NAME;
        const snsConfig = JSON.parse(process.env.SNS_CONFIG);
        const headless = process.env.HEADLESS === 'true' ? true : false;

        if (!snsName || !snsConfig) {
            log.error('SNS_NAME または SNS_CONFIG が設定されていません');
            process.exit(1);
        }

        const {
            name: snsFullName,
            login_url: loginUrl,
            cookies_path: cookiesPath,
            profile_path: profilePath,
            username_selector: usernameSel,
            password_selector: passwordSel,
            submit_button: submitBtn,
            logged_in_indicators: loggedInIndicators,
            login_timeout_ms: loginTimeout,
            wait_after_login_ms: waitAfter,
            env_vars: envVars,
            dismissable_dialogs: dialogs
        } = snsConfig;

        log.step(`🔐 ${snsFullName} ログインセットアップ`);

        // ディレクトリ初期化
        fs.mkdirSync(path.dirname(profilePath), { recursive: true });
        fs.mkdirSync(path.dirname(cookiesPath), { recursive: true });

        // 環境変数から認証情報を取得
        const usernameEnvKey = envVars.username;
        const passwordEnvKey = envVars.password;
        
        let username = process.env[usernameEnvKey];
        let password = process.env[passwordEnvKey];

        if (!username || !password) {
            log.warn(`環境変数 ${usernameEnvKey} または ${passwordEnvKey} が設定されていません`);
            console.log(`\n必要な環境変数:\n  - ${usernameEnvKey}\n  - ${passwordEnvKey}\n`);
            
            // インタラクティブ入力（オプション）
            const doInteractive = await question('インタラクティブ入力しますか？ (y/N): ');
            if (doInteractive.toLowerCase() === 'y') {
                username = await question(`${usernameEnvKey}: `);
                password = await question(`${passwordEnvKey}: `);
            } else {
                log.error('認証情報が不足しています');
                process.exit(1);
            }
        }

        log.info(`URL: ${loginUrl}`);
        log.info(`プロファイル: ${profilePath}`);
        log.info(`Cookie保存先: ${cookiesPath}`);

        // ブラウザを起動
        log.step(`🌐 ブラウザを起動中...`);
        const browser = await chromium.launchPersistentContext(profilePath, {
            headless: headless,
            viewport: { width: 1280, height: 720 }
        });

        const page = browser.pages()[0] || await browser.newPage();

        log.info(`ページにアクセス: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // ログイン状態を確認
        log.info('ログイン状態を確認中...');
        let isLoggedIn = false;

        for (const selector of loggedInIndicators) {
            try {
                if (await page.locator(selector).count() > 0) {
                    isLoggedIn = true;
                    log.success(`ログイン指標を検出: ${selector}`);
                    break;
                }
            } catch (e) {
                // セレクタが有効でない場合はスキップ
            }
        }

        if (isLoggedIn) {
            log.success('既にログイン済みです！');
            await browser.close();
            process.exit(0);
        }

        // ログイン処理
        log.step(`🔐 ログイン処理を開始`);

        log.info('ログインフォームを待機中...');
        await page.waitForSelector(usernameSel, { timeout: 5000 });
        
        log.info('認証情報を入力...');
        await page.fill(usernameSel, username);
        await page.fill(passwordSel, password);

        log.info('ログインボタンをクリック...');
        await page.click(submitBtn);

        // ログイン完了を待機
        log.info(`ログイン処理を待機中（最大${loginTimeout}ms）...`);
        let loginSuccess = false;

        try {
            for (const selector of loggedInIndicators) {
                try {
                    await page.locator(selector).first().waitFor({ timeout: loginTimeout });
                    loginSuccess = true;
                    log.success('ログイン成功！');
                    break;
                } catch (e) {
                    // このセレクタではタイムアウト、次を試す
                }
            }
        } catch (e) {
            log.warn('ログイン指標要素が見つかりませんでした');
        }

        if (loginSuccess) {
            await page.waitForTimeout(waitAfter);
        } else {
            log.warn('ログイン指標が確認できませんでしたが、続行します');
        }

        // ダイアログを自動で閉じる（オプション）
        if (dialogs && dialogs.length > 0) {
            log.step(`🔔 ダイアログを処理中...`);
            for (const dialog of dialogs) {
                const { selector, label } = dialog;
                try {
                    const btn = page.locator(selector).first();
                    if (await btn.count() > 0) {
                        log.info(`ダイアログを閉じる: ${label}`);
                        await btn.click();
                        await page.waitForTimeout(1000);
                    }
                } catch (e) {
                    // ダイアログが見つからない場合はスキップ
                }
            }
        }

        // Cookies を保存
        log.step(`💾 Cookies を保存中...`);
        const cookies = await page.context().cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        log.success(`Cookies を保存しました: ${cookiesPath}`);

        // ブラウザを閉じる
        await browser.close();
        log.success('ブラウザを閉じました');

        process.exit(0);

    } catch (error) {
        log.error(`エラーが発生しました: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// メイン処理を実行
main().catch(err => {
    log.error(`予期しないエラー: ${err.message}`);
    process.exit(1);
});
