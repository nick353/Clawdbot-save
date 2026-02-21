// SNS自動投稿 - BAN対策ブラウザ起動
// Level 2: 高度検出回避（undetected-browser + stealth plugin）
// 作成日: 2026-02-21

const UndetectableBrowser = require('undetected-browser');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { config, getRandomUserAgent, bypassChromeDetection } = require('./anti-ban-helpers.js');

// Stealth plugin 適用
puppeteerExtra.use(StealthPlugin());

/**
 * BAN対策ブラウザ起動
 * @param {Object} options - オプション
 * @returns {Promise<Object>} { browser, page }
 */
async function launchAntiBanBrowser(options = {}) {
  const {
    headless = 'new',
    proxy = null,
    userAgent = null,
  } = options;

  try {
    console.log('🚀 BAN対策ブラウザ起動中...');

    // ブラウザ起動設定
    const launchOptions = {
      headless,
      args: [
        ...config.browserArgs,
        ...(proxy ? [`--proxy-server=${proxy}`] : []),
      ],
      ignoreHTTPSErrors: true,
      defaultViewport: null,
    };

    // User-Agent設定
    if (userAgent) {
      const uaIndex = launchOptions.args.findIndex(arg => arg.startsWith('--user-agent='));
      if (uaIndex !== -1) {
        launchOptions.args[uaIndex] = `--user-agent=${userAgent}`;
      }
    } else {
      const randomUA = getRandomUserAgent();
      const uaIndex = launchOptions.args.findIndex(arg => arg.startsWith('--user-agent='));
      if (uaIndex !== -1) {
        launchOptions.args[uaIndex] = `--user-agent=${randomUA}`;
      }
    }

    // Puppeteer Extra で起動（Stealth plugin 適用済み）
    const baseBrowser = await puppeteerExtra.launch(launchOptions);

    // Undetectable Browser でラップ
    const UndetectableBMS = new UndetectableBrowser(baseBrowser);
    const browser = await UndetectableBMS.getBrowser();
    const page = await browser.newPage();

    // Chrome Detection 対策
    await bypassChromeDetection(page);

    // Timezone設定（日本時間）
    await page.emulateTimezone('Asia/Tokyo');

    // 言語設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    console.log('✅ BAN対策ブラウザ起動完了');
    console.log(`   User-Agent: ${userAgent || getRandomUserAgent()}`);
    console.log(`   Proxy: ${proxy || 'なし'}`);

    return { browser, page };
  } catch (error) {
    console.error('❌ ブラウザ起動エラー:', error);
    throw error;
  }
}

/**
 * 既存のブラウザインスタンスをBAN対策強化
 * @param {Object} browser - Puppeteerブラウザインスタンス
 * @returns {Promise<Object>} { browser, page }
 */
async function enhanceExistingBrowser(browser) {
  try {
    console.log('🔧 既存ブラウザをBAN対策強化中...');

    const UndetectableBMS = new UndetectableBrowser(browser);
    const enhancedBrowser = await UndetectableBMS.getBrowser();
    const page = await enhancedBrowser.newPage();

    // Chrome Detection 対策
    await bypassChromeDetection(page);

    // Timezone設定（日本時間）
    await page.emulateTimezone('Asia/Tokyo');

    // 言語設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    console.log('✅ BAN対策強化完了');

    return { browser: enhancedBrowser, page };
  } catch (error) {
    console.error('❌ ブラウザ強化エラー:', error);
    throw error;
  }
}

module.exports = {
  launchAntiBanBrowser,
  enhanceExistingBrowser,
};
