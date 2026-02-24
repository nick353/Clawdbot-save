#!/usr/bin/env node
/**
 * Instagram投稿 - Step 3: 「Create」テキストをクリックしてモーダルを開く
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = '/root/clawd/skills/sns-multi-poster/cookies/instagram.json';
const SCREENSHOT_DIR = '/tmp/instagram-visual-debug';

function loadCookies() {
  const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
  return cookies.map(c => ({
    name: c.name,
    value: decodeURIComponent(c.value),
    domain: c.domain || '.instagram.com',
    path: c.path || '/',
    secure: c.secure !== false,
    httpOnly: c.httpOnly === true,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
    expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
  }));
}

async function main() {
  console.log('🚀 Step 3: 「Create」テキストをクリック');
  
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  });

  const cookies = loadCookies();
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    // ホームページに遷移
    console.log('📄 Instagram投稿ページに遷移...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await page.waitForTimeout(3000);
    
    // サイドバー展開（「+」ボタンをクリック）
    console.log('🖱️ サイドバーを展開...');
    const plusButton = await page.$('svg[aria-label="New post"]');
    if (plusButton) {
      await plusButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ サイドバー展開完了');
    }
    
    // 「Create」テキストをクリック
    console.log('🔍 「Create」テキストを探索...');
    
    // 複数の方法で「Create」を探す
    const selectors = [
      'text=Create',
      'span:has-text("Create")',
      'a:has-text("Create")',
      'div:has-text("Create")',
      '[role="link"]:has-text("Create")'
    ];
    
    let createLink = null;
    let usedSelector = '';
    
    for (const selector of selectors) {
      try {
        createLink = await page.$(selector);
        if (createLink) {
          usedSelector = selector;
          console.log(`✅ 「Create」発見: ${selector}`);
          break;
        }
      } catch (e) {
        // セレクタエラーは無視
      }
    }
    
    if (!createLink) {
      console.log('⚠️ セレクタで見つからない。画像で確認...');
      
      const screenshot = path.join(SCREENSHOT_DIR, '03-before-create-click.png');
      await page.screenshot({ path: screenshot, fullPage: false });
      console.log(`📸 スクリーンショット: ${screenshot}`);
      
      throw new Error('「Create」テキストが見つかりません。');
    }
    
    // 「Create」をクリック
    console.log('🖱️ 「Create」をクリック...');
    await createLink.click();
    await page.waitForTimeout(3000);
    
    // モーダル表示確認
    const screenshot = path.join(SCREENSHOT_DIR, '03-after-create-click.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    console.log(`📸 スクリーンショット: ${screenshot}`);
    
    // モーダル内の要素を確認
    const modalElements = await page.evaluate(() => {
      const elements = [];
      // 画面全体から投稿関連のテキストを探す
      document.querySelectorAll('span, button, div').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text && text.length < 100) {
          const rect = el.getBoundingClientRect();
          // 画面中央付近の要素のみ
          if (rect.left > 200 && rect.left < 1000 && rect.top > 100 && rect.top < 700) {
            elements.push({
              tag: el.tagName,
              text: text.substring(0, 50),
              role: el.getAttribute('role'),
              position: `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}`
            });
          }
        }
      });
      return elements.slice(0, 30); // 最初の30個のみ
    });
    
    console.log('');
    console.log('🔍 モーダル内の要素:');
    console.log(JSON.stringify(modalElements, null, 2));
    
    console.log('');
    console.log('✅ Step 3 完了');
    console.log(`📸 スクリーンショット確認: ${screenshot}`);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    const errorScreenshot = path.join(SCREENSHOT_DIR, 'error-step3.png');
    await page.screenshot({ path: errorScreenshot, fullPage: false });
    console.log(`📸 エラー時スクリーンショット: ${errorScreenshot}`);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('❌ 致命的エラー:', error);
  process.exit(1);
});
