#!/usr/bin/env node
/**
 * Instagram投稿 - Step 2: 「+」ボタンをクリックしてモーダルを開く
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
  console.log('🚀 Step 2: 「+」ボタンをクリック');
  
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
  console.log(`✅ Cookie設定完了`);

  const page = await context.newPage();

  try {
    // ホームページに遷移
    console.log('📄 Instagram投稿ページに遷移...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await page.waitForTimeout(3000);
    
    // 「+」ボタンを探す
    console.log('🔍 「+」ボタンを探索...');
    
    // 複数の方法で「+」ボタンを試す
    const selectors = [
      'a[href="#"][aria-label*="Create"]',
      'a[href="#"][aria-label*="New"]',
      'a[href*="create"]',
      'svg[aria-label="New post"]',
      'div[role="button"]:has-text("Create")',
      // 最終手段: サイドバーの「+」アイコンを直接検索
      'a[href="#"]:has(svg)'
    ];
    
    let createButton = null;
    let usedSelector = '';
    
    for (const selector of selectors) {
      try {
        createButton = await page.$(selector);
        if (createButton) {
          usedSelector = selector;
          console.log(`✅ 「+」ボタン発見: ${selector}`);
          break;
        }
      } catch (e) {
        // セレクタエラーは無視
      }
    }
    
    if (!createButton) {
      console.log('⚠️ セレクタで見つからない。画像で確認...');
      
      const screenshot = path.join(SCREENSHOT_DIR, '02-before-click.png');
      await page.screenshot({ path: screenshot, fullPage: false });
      console.log(`📸 スクリーンショット: ${screenshot}`);
      
      // すべてのリンクとボタンをログ出力
      const allButtons = await page.evaluate(() => {
        const buttons = [];
        document.querySelectorAll('a, button, div[role="button"]').forEach((el, index) => {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const href = el.getAttribute('href') || '';
          
          // サイドバー内の要素のみ（左側100px以内）
          const rect = el.getBoundingClientRect();
          if (rect.left < 100) {
            buttons.push({
              index,
              tag: el.tagName,
              text: text.substring(0, 30),
              ariaLabel,
              href,
              position: `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}`,
              size: `w:${Math.round(rect.width)}, h:${Math.round(rect.height)}`
            });
          }
        });
        return buttons;
      });
      
      console.log('🔍 サイドバーの要素:');
      console.log(JSON.stringify(allButtons, null, 2));
      
      throw new Error('「+」ボタンが見つかりません。スクリーンショットを確認してください。');
    }
    
    // 「+」ボタンをクリック
    console.log('🖱️ 「+」ボタンをクリック...');
    await createButton.click();
    await page.waitForTimeout(2000);
    
    // モーダル表示確認
    const screenshot = path.join(SCREENSHOT_DIR, '02-after-click.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    console.log(`📸 スクリーンショット: ${screenshot}`);
    
    // モーダル内の要素を確認
    const modalElements = await page.evaluate(() => {
      const elements = [];
      document.querySelectorAll('[role="dialog"] button, [role="dialog"] span, [role="dialog"] div').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text) {
          elements.push({
            tag: el.tagName,
            text: text.substring(0, 50),
            role: el.getAttribute('role')
          });
        }
      });
      return elements;
    });
    
    console.log('');
    console.log('🔍 モーダル内の要素:');
    console.log(JSON.stringify(modalElements, null, 2));
    
    console.log('');
    console.log('✅ Step 2 完了');
    console.log(`📸 スクリーンショット確認: ${screenshot}`);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    const errorScreenshot = path.join(SCREENSHOT_DIR, 'error-step2.png');
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
