#!/usr/bin/env node
/**
 * Instagram 作成ボタン特定スクリプト
 * ページ内のすべての要素を列挙して作成ボタンを見つける
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/root/clawd/browser-profiles/instagram';
const STATE_PATH = path.join(PROFILE_DIR, 'browser-state.json');
const COOKIES_PATH = path.join(PROFILE_DIR, 'cookies.json');

async function main() {
  console.log('🔍 Instagram 作成ボタン特定スクリプト');
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });

  try {
    if (!fs.existsSync(STATE_PATH) || !fs.existsSync(COOKIES_PATH)) {
      console.log('⚠️  ブラウザプロファイルが見つかりません');
      process.exit(1);
    }

    const context = await browser.newContext({
      storageState: STATE_PATH,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await context.addCookies(cookies);

    const page = await context.newPage();
    page.setDefaultTimeout(60000);

    // Instagram にアクセス
    console.log('🌐 Instagram にアクセスしています...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    // すべての a[href="#"] 要素を確認
    console.log('');
    console.log('📋 すべての a[href="#"] 要素:');
    const links = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a[href="#"]'));
      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          text: el.textContent?.trim().substring(0, 50) || '',
          ariaLabel: el.getAttribute('aria-label'),
          role: el.getAttribute('role'),
          position: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          innerHTML: el.innerHTML.substring(0, 200),
        };
      });
    });

    console.log(JSON.stringify(links, null, 2));

    // SVG要素も確認
    console.log('');
    console.log('📋 SVG要素:');
    const svgs = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('svg[aria-label]'));
      return elements.slice(0, 20).map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          ariaLabel: el.getAttribute('aria-label'),
          position: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
    });

    console.log(JSON.stringify(svgs, null, 2));

    // ナビゲーションバー内の要素を確認
    console.log('');
    console.log('📋 ナビゲーションバー内の要素:');
    const navElements = await page.evaluate(() => {
      const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
      if (!nav) return null;
      
      const elements = Array.from(nav.querySelectorAll('a, button, [role="button"]'));
      return elements.slice(0, 15).map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 30) || '',
          ariaLabel: el.getAttribute('aria-label'),
          href: el.getAttribute('href'),
          position: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
    });

    console.log(JSON.stringify(navElements, null, 2));

    await context.close();
    console.log('');
    console.log('✅ 完了');
  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
