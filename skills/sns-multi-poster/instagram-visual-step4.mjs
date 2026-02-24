#!/usr/bin/env node
/**
 * Instagram投稿 - Step 4: 直接投稿作成ページに遷移
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
  console.log('🚀 Step 4: 投稿作成ページに直接遷移');
  
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
    // 投稿作成ページに直接遷移
    console.log('📄 投稿作成ページに遷移...');
    await page.goto('https://www.instagram.com/create/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await page.waitForTimeout(3000);
    
    // スクリーンショット撮影
    const screenshot = path.join(SCREENSHOT_DIR, '04-create-page.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    console.log(`📸 スクリーンショット: ${screenshot}`);
    
    // ページの要素を確認
    const pageElements = await page.evaluate(() => {
      const elements = [];
      document.querySelectorAll('button, span, div, input').forEach(el => {
        const text = el.textContent?.trim() || '';
        const tag = el.tagName;
        const type = el.getAttribute('type');
        
        if ((text && text.length < 100) || type === 'file') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            elements.push({
              tag: tag,
              type: type,
              text: text.substring(0, 50),
              role: el.getAttribute('role'),
              ariaLabel: el.getAttribute('aria-label'),
              position: `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}`,
              size: `w:${Math.round(rect.width)}, h:${Math.round(rect.height)}`
            });
          }
        }
      });
      return elements.slice(0, 50); // 最初の50個
    });
    
    console.log('');
    console.log('🔍 ページ内の要素:');
    console.log(JSON.stringify(pageElements, null, 2));
    
    console.log('');
    console.log('✅ Step 4 完了');
    console.log(`📸 スクリーンショット確認: ${screenshot}`);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    const errorScreenshot = path.join(SCREENSHOT_DIR, 'error-step4.png');
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
