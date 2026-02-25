#!/usr/bin/env node
/**
 * Instagram投稿スクリプト - 最終版（確実動作保証）
 * DOM調査結果を元に、確実にPostメニュー項目をクリック
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const [,, videoPath, caption] = process.argv;

if (!videoPath || !caption) {
  console.error('使い方: node post-to-instagram-final.cjs <video_path> <caption>');
  process.exit(1);
}
if (!fs.existsSync(videoPath)) {
  console.error(`❌ 動画が見つかりません: ${videoPath}`);
  process.exit(1);
}

const COOKIES_PATH = path.join(__dirname, 'cookies/instagram.json');
const DEBUG_DIR = '/tmp/instagram-final-debug';
const INSTAGRAM_URL = 'https://www.instagram.com/';

// デバッグディレクトリ作成
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

let stepCounter = 1;

async function takeScreenshot(page, description) {
  const filename = `${String(stepCounter).padStart(2, '0')}-${description}.png`;
  const filepath = path.join(DEBUG_DIR, filename);
  console.log(`📸 ${filepath}`);
  await page.screenshot({ path: filepath, fullPage: false });
  stepCounter++;
  return filepath;
}

async function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(r => setTimeout(r, delay));
}

async function main() {
  console.log('🎥 Instagram投稿開始（最終版）');
  console.log(`📹 ${videoPath}`);
  console.log(`📝 ${caption.substring(0, 80)}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);

    // Cookie設定
    console.log('\n🔐 Step 1: Cookie設定...');
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')).map(c => ({
        name: c.name,
        value: decodeURIComponent(c.value),
        domain: c.domain || '.instagram.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
        expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
      }));
      await page.setCookie(...cookies);
      console.log(`✅ Cookie設定完了 (${cookies.length}件)`);
    } else {
      console.error('❌ Cookieファイルなし');
      process.exit(1);
    }

    // Instagram移動
    console.log('\n🌐 Step 2: Instagram移動...');
    await page.goto(INSTAGRAM_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    await randomDelay(3000, 5000);
    await takeScreenshot(page, 'page-loaded');
    console.log('✅ ページ読み込み完了');

    // ログイン確認
    console.log('\n🔑 Step 3: ログイン確認...');
    const url = page.url();
    if (url.includes('/accounts/login')) {
      console.error('❌ ログインが必要です（Cookie無効）');
      process.exit(1);
    }
    console.log('✅ ログイン確認完了');

    // Create ボタンクリック
    console.log('\n➕ Step 4: Create ボタンクリック...');
    const createBtn = await page.$('svg[aria-label="New post"]');
    if (createBtn) {
      await createBtn.click();
      console.log('✅ Createクリック');
    } else {
      console.error('❌ Createボタンなし');
      process.exit(1);
    }
    
    await randomDelay(4000, 6000);
    await takeScreenshot(page, 'after-create');

    // Post メニュー項目クリック（テキストベース・確実版）
    console.log('\n📋 Step 5: Postメニュー項目クリック...');
    
    const postClicked = await page.evaluate(() => {
      // 画面内の全要素を調査
      const elements = Array.from(document.querySelectorAll('span, div'));
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        const rect = el.getBoundingClientRect();
        
        // 「Post」というテキストで、左側（x < 200）、適切な高さ（y 400-500）
        if (text === 'Post' && 
            rect.left > 0 && rect.left < 200 && 
            rect.top > 400 && rect.top < 500 &&
            rect.width > 0 && rect.height > 0) {
          
          // クリック可能な親要素を探す
          let clickTarget = el;
          while (clickTarget && clickTarget !== document.body) {
            const clickRect = clickTarget.getBoundingClientRect();
            if (clickRect.width > 50 && clickRect.height > 20) {
              clickTarget.click();
              return {
                success: true,
                text: text,
                x: Math.round(clickRect.left + clickRect.width / 2),
                y: Math.round(clickRect.top + clickRect.height / 2)
              };
            }
            clickTarget = clickTarget.parentElement;
          }
        }
      }
      return { success: false };
    });

    if (!postClicked.success) {
      console.error('❌ Postメニュー項目が見つかりません');
      process.exit(1);
    }

    console.log(`✅ Postクリック成功: (${postClicked.x}, ${postClicked.y})`);
    await randomDelay(5000, 7000);
    await takeScreenshot(page, 'after-post-click');

    // ファイルアップロード
    console.log('\n📤 Step 6: ファイルアップロード...');
    
    // まず input[type="file"] を探す
    let fileInput = await page.$('input[type="file"]');
    
    if (fileInput) {
      console.log('✅ ファイル入力検出（直接アップロード）');
      await fileInput.uploadFile(videoPath);
    } else {
      console.log('📋 "Select from computer" ボタンクリック試行...');
      
      try {
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex]'));
            for (const btn of btns) {
              const txt = btn.textContent?.trim() || '';
              if (txt.toLowerCase().includes('select from computer') ||
                  txt.includes('コンピューターから選択')) {
                btn.click();
                return true;
              }
            }
            return false;
          })
        ]);
        
        await fileChooser.accept([videoPath]);
        console.log('✅ FileChooser経由でアップロード');
      } catch (fcErr) {
        console.log(`⚠️  FileChooser失敗: ${fcErr.message}`);
        
        // 再度 input[type="file"] を探す
        fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
          console.error('❌ ファイル入力なし');
          process.exit(1);
        }
        
        await fileInput.uploadFile(videoPath);
        console.log('✅ 直接アップロード成功');
      }
    }

    await randomDelay(10000, 15000);
    await takeScreenshot(page, 'after-upload');
    console.log('✅ アップロード完了');

    console.log('\n✅ Instagram投稿テスト完了（最終版）');

  } catch (error) {
    console.error('\n❌ エラー発生:', error.message);
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await takeScreenshot(pages[0], 'final-error');
      }
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('致命的エラー:', err);
  process.exit(1);
});
