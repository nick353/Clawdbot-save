#!/usr/bin/env node
/**
 * Instagram 投稿スクリプト v6.2
 * v6.1 + セレクタ改善版
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

const {
  checkRateLimit,
  logPost,
  isAllowedPostingTime,
  randomDelay,
} = require('./lib/anti-ban-helpers.js');

puppeteer.use(StealthPlugin());

const [, , imagePath, caption] = process.argv;

if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-v6.2.cjs <image_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const VPS_CONFIG = {
  navigationTimeout: 30000,
  defaultTimeout: 30000,
};

async function shot(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = `/tmp/ig-62-${label}-${ts}.png`;
  await page.screenshot({ path: p, fullPage: true }).catch(() => null);
  if (fs.existsSync(p)) console.log(`📸 ${label} - ${Math.floor(fs.statSync(p).size / 1024)}KB`);
  return p;
}

async function clickElement(page, selector, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const el = await page.$(selector).catch(() => null);
    if (el) {
      await el.click().catch(() => null);
      console.log(`✅ クリック: ${selector}`);
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function clickByAriaLabel(page, ariaLabel, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const found = await page.evaluate(label => {
      const els = document.querySelectorAll('[aria-label]');
      for (const el of els) {
        if (el.getAttribute('aria-label')?.toLowerCase().includes(label.toLowerCase())) {
          el.click();
          return el.getAttribute('aria-label');
        }
      }
      return null;
    }, ariaLabel);
    if (found) {
      console.log(`✅ クリック (aria-label): ${found}`);
      return true;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log('📸 Instagram v6.2 (セレクタ改善)');
  
  if (!isAllowedPostingTime()) process.exit(1);
  if (!(await checkRateLimit('instagram'))) process.exit(1);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
      '--single-process',
      '--disable-web-resources',
      '--enable-features=NetworkService,NetworkServiceInProcess',
    ],
    timeout: VPS_CONFIG.navigationTimeout,
    protocolTimeout: VPS_CONFIG.navigationTimeout,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(VPS_CONFIG.defaultTimeout);
    page.setDefaultNavigationTimeout(VPS_CONFIG.navigationTimeout);

    console.log(`⏱️  タイムアウト: ${VPS_CONFIG.defaultTimeout}ms`);

    // Cookie設定
    console.log('🔐 Cookie読み込み...');
    if (!fs.existsSync(COOKIES_PATH)) {
      throw new Error(`Cookie見つかりません: ${COOKIES_PATH}`);
    }
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log(`✅ Cookie設定完了 (${cookies.length}件)`);

    // Instagram へアクセス
    console.log('🌐 Instagram にアクセス...');
    const startTime = Date.now();
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded', 
      timeout: VPS_CONFIG.navigationTimeout 
    });
    const loadTime = Date.now() - startTime;
    console.log(`✅ ロード完了 (${loadTime}ms)`);
    await shot(page, '01-loaded');

    // ログイン確認
    const loggedIn = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label'));
      return labels.some(l => l?.includes('ホーム') || l?.includes('Home'));
    });
    if (!loggedIn) throw new Error('ログイン失敗');
    console.log('✅ ログイン確認');

    // 新規投稿ボタン（複数セレクタ試行）
    console.log('➕ 新規投稿ボタン検索...');
    let found = false;
    
    // 方法1: aria-labelで検索
    found = await clickByAriaLabel(page, 'create', 15000);
    
    // 方法2: SVGのテキストで検索
    if (!found) {
      found = await page.evaluate(() => {
        const btns = document.querySelectorAll('a, button, [role="button"]');
        for (const btn of btns) {
          const text = btn.innerText?.toLowerCase() || btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (text.includes('create') || text.includes('新') || text.includes('投稿')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (found) console.log('✅ クリック (テキスト検索)');
    }
    
    // 方法3: href="/create/..."で検索
    if (!found) {
      found = await clickElement(page, 'a[href="/create/"]', 5000);
    }

    if (!found) {
      await shot(page, '02-no-create-btn');
      throw new Error('新規投稿ボタンが見つかりません');
    }

    await randomDelay(2000, 3000);

    // Post メニュー選択
    console.log('📝 メニュー: Post');
    const postFound = await clickElement(page, 'button:has-text("Post")', 5000) ||
                      await clickByAriaLabel(page, 'post', 5000) ||
                      await page.evaluate(() => {
                        const btns = document.querySelectorAll('button, [role="button"]');
                        for (const btn of btns) {
                          if (btn.innerText?.trim() === 'Post') {
                            btn.click();
                            return true;
                          }
                        }
                        return false;
                      });
    
    if (!postFound) console.warn('⚠️  Post メニュー見つかりませんが続行...');
    await randomDelay(3000, 4000);
    await shot(page, '02-menu');

    // ファイルアップロード
    console.log('📤 ファイルアップロード...');
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('ファイル入力が見つかりません');
    }
    await fileInput.uploadFile(imagePath);
    console.log('✅ アップロード完了');
    await randomDelay(4000, 6000);
    await shot(page, '03-uploaded');

    // 次へボタン (max 3回)
    for (let i = 1; i <= 3; i++) {
      const captionCheck = await page.$('div[contenteditable="true"]').catch(() => null);
      if (captionCheck) {
        console.log('✅ キャプション画面到達');
        break;
      }
      console.log(`⏭️  次へ (${i}/3)...`);
      await randomDelay(1500, 2500);
      
      const nextFound = await clickElement(page, 'button:contains("Next")', 3000) ||
                        await page.evaluate(() => {
                          const btns = document.querySelectorAll('button, [role="button"]');
                          for (const btn of btns) {
                            if (btn.innerText?.trim().toLowerCase().includes('next')) {
                              btn.click();
                              return true;
                            }
                          }
                          return false;
                        });
      
      if (!nextFound && i >= 2) break;
      await randomDelay(2500, 4000);
    }
    await shot(page, '04-caption-ready');

    // キャプション入力
    console.log('✍️  キャプション入力...');
    const captionEl = await page.$('div[contenteditable="true"]').catch(() => null);
    if (captionEl) {
      await captionEl.click();
      await randomDelay(500, 1000);
      for (const char of caption) {
        await page.keyboard.type(char);
        await randomDelay(50, 150);
      }
      console.log('✅ キャプション入力完了');
    } else {
      console.warn('⚠️  キャプション入力エリアなし');
    }
    await randomDelay(2000, 3000);
    await shot(page, '05-caption-done');

    // 投稿ボタン
    console.log('🚀 投稿処理...');
    let posted = false;
    
    for (let retry = 0; retry < 2; retry++) {
      console.log(`${retry === 0 ? '初回' : 'リトライ'} 投稿...`);
      await randomDelay(1000, 2000);
      
      const shareFound = await clickElement(page, 'button:contains("Share")', 5000) ||
                         await clickByAriaLabel(page, 'share', 5000) ||
                         await page.evaluate(() => {
                           const btns = document.querySelectorAll('button, [role="button"]');
                           for (const btn of btns) {
                             const text = btn.innerText?.trim().toLowerCase() || '';
                             if (text === 'share' || text === 'シェア' || text === '投稿') {
                               btn.click();
                               return true;
                             }
                           }
                           return false;
                         });
      
      if (!shareFound) {
        await shot(page, `06-no-share-r${retry}`);
        if (retry === 0) {
          console.warn('⚠️  投稿ボタン見つからず。リトライ...');
          await randomDelay(2000, 3000);
          continue;
        } else {
          throw new Error('投稿ボタンが見つかりません');
        }
      }
      
      console.log('✅ 投稿ボタンクリック');
      console.log('⏳ 完了待機 (15秒)...');
      await randomDelay(13000, 17000);
      
      const hasError = await page.evaluate(() => {
        const errorTexts = ['エラーが発生', 'Something went wrong', 'Error'];
        return Array.from(document.querySelectorAll('*')).some(el =>
          errorTexts.some(text => el.textContent?.includes(text))
        );
      });
      
      if (hasError) {
        console.warn('⚠️  エラーダイアログ検出');
        if (retry === 0) {
          await randomDelay(5000, 8000);
          continue;
        } else {
          throw new Error('投稿エラー（リトライ上限）');
        }
      }
      
      posted = true;
      console.log('✅ 投稿完了！');
      break;
    }

    if (!posted) {
      throw new Error('投稿失敗');
    }

    await shot(page, '07-success');
    await logPost('instagram');
    console.log('\n🎉 Instagram投稿成功！');

  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
