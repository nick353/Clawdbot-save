#!/usr/bin/env node
/**
 * Playwright ブラウザ認証ユーティリティ
 * ブラウザプロファイルの保存・読み込み・キャッシュ管理
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PlaywrightBrowserAuth {
  constructor(profileName = 'default') {
    this.profileName = profileName;
    this.profileDir = path.join('/root/clawd/browser-profiles', profileName);
    this.statePath = path.join(this.profileDir, 'browser-state.json');
    this.cookiesPath = path.join(this.profileDir, 'cookies.json');
    this.metadataPath = path.join(this.profileDir, 'metadata.json');
  }

  /**
   * ブラウザプロファイルを作成・初期化
   */
  ensureProfileDir() {
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }
  }

  /**
   * ブラウザコンテキストを作成（プロファイル読み込み）
   */
  async createBrowserContext(browser, options = {}) {
    this.ensureProfileDir();

    const contextOptions = {
      ...options,
      // iPhone 12 Pro を使用して検出回避強化
      ...{
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
      },
    };

    // 既存のプロファイルがあれば読み込み
    if (fs.existsSync(this.statePath)) {
      console.log(`📂 プロファイルを読み込み: ${this.profileName}`);
      contextOptions.storageState = this.statePath;
    }

    const context = await browser.newContext(contextOptions);

    // クッキーも読み込む（フォールバック用）
    if (fs.existsSync(this.cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
      await context.addCookies(cookies);
    }

    return context;
  }

  /**
   * ブラウザコンテキストの状態を保存
   */
  async saveContext(context) {
    this.ensureProfileDir();

    try {
      // Playwright の状態ファイルを保存
      const state = await context.storageState();
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));

      // クッキーを個別に保存（互換性のため）
      const cookies = await context.cookies();
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));

      // メタデータを記録
      const metadata = {
        savedAt: new Date().toISOString(),
        profileName: this.profileName,
        cookieCount: cookies.length,
      };
      fs.writeFileSync(this.metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`✅ プロファイルを保存: ${this.profileName}`);
      console.log(`   - cookies: ${cookies.length}`);
      console.log(`   - storageState: ${state.origins?.length || 0} origins`);
    } catch (error) {
      console.error(`❌ プロファイル保存失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * プロファイルが存在するか確認
   */
  profileExists() {
    return fs.existsSync(this.statePath) && fs.existsSync(this.cookiesPath);
  }

  /**
   * プロファイル情報を取得
   */
  getProfileInfo() {
    if (!fs.existsSync(this.metadataPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'));
  }

  /**
   * プロファイルを削除
   */
  deleteProfile() {
    if (fs.existsSync(this.profileDir)) {
      fs.rmSync(this.profileDir, { recursive: true, force: true });
      console.log(`🗑️  プロファイルを削除: ${this.profileName}`);
    }
  }

  /**
   * ブラウザ起動オプション（検出回避強化）
   */
  static getBrowserLaunchOptions() {
    return {
      headless: false, // 初回ログインはヘッドフルモード
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-features=VizDisplayCompositor',
      ],
    };
  }

  /**
   * ヘッドレス実行用オプション
   */
  static getHeadlessOptions() {
    return {
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-features=VizDisplayCompositor',
      ],
    };
  }
}

module.exports = { PlaywrightBrowserAuth, chromium };
