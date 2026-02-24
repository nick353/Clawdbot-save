#!/usr/bin/env node
/**
 * Instagram投稿 - Step 1: ホームページ確認
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
  console.log('🚀 Step 1: Instagramホームページ確認');
  
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
  console.log(`✅ Cookie設定完了（${cookies.length}個）`);

  const page = await context.newPage();

  try {
    console.log('📄 Instagram投稿ページに遷移...');
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await page.waitForTimeout(3000);
    
    // スクリーンショット撮影
    const screenshot = path.join(SCREENSHOT_DIR, '01-homepage.png');
    await page.screenshot({ path: screenshot, fullPage: false });
    console.log(`📸 スクリーンショット: ${screenshot}`);
    
    // 「Create」ボタン候補を探索
    const createButtons = await page.evaluate(() => {
      const keywords = ['create', 'post', 'new', '作成', '投稿', '新規'];
      const elements = [];
      
      document.querySelectorAll('a, button, div[role="button"], span[role="link"]').forEach(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const href = el.getAttribute('href') || '';
        
        if (keywords.some(kw => text.includes(kw) || ariaLabel.includes(kw) || href.includes(kw))) {
          elements.push({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 50),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            href: href,
            selector: el.className ? `.${el.className.split(' ')[0]}` : el.tagName
          });
        }
      });
      
      return elements;
    });
    
    console.log('');
    console.log('🔍 「Create」ボタン候補:');
    console.log(JSON.stringify(createButtons, null, 2));
    
    console.log('');
    console.log('✅ Step 1 完了');
    console.log(`📸 スクリーンショット確認: ${screenshot}`);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    const errorScreenshot = path.join(SCREENSHOT_DIR, 'error-step1.png');
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
