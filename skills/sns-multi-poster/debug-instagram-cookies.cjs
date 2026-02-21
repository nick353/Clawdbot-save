#!/usr/bin/env node
/**
 * Instagram UI デバッグ（Cookie認証版）
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugInstagram() {
  console.log('🔍 Instagram UI デバッグ（Cookie認証）');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Cookieを読み込み
    const cookiesPath = path.join(__dirname, 'cookies/instagram.json');
    const cookiesData = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookiesData);
    console.log('🔐 Cookie設定完了');
    
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📍 現在のURL:', await page.url());
    
    // ページ全体のリンクとボタンを取得
    const elements = await page.evaluate(() => {
      const result = {
        links: [],
        buttons: [],
        svgs: [],
        nav: null
      };
      
      // すべてのリンク
      document.querySelectorAll('a').forEach((el, i) => {
        if (i < 50) {  // 最初の50個のみ
          result.links.push({
            href: el.getAttribute('href'),
            ariaLabel: el.getAttribute('aria-label'),
            text: el.innerText?.substring(0, 50),
            hasSVG: !!el.querySelector('svg'),
            svgLabel: el.querySelector('svg')?.getAttribute('aria-label')
          });
        }
      });
      
      // すべてのボタン
      document.querySelectorAll('button').forEach((el, i) => {
        if (i < 30) {  // 最初の30個のみ
          result.buttons.push({
            type: el.getAttribute('type'),
            ariaLabel: el.getAttribute('aria-label'),
            text: el.innerText?.substring(0, 50),
            class: el.className
          });
        }
      });
      
      // すべてのSVG
      document.querySelectorAll('svg').forEach((el, i) => {
        if (i < 20) {  // 最初の20個のみ
          result.svgs.push({
            ariaLabel: el.getAttribute('aria-label'),
            role: el.getAttribute('role'),
            parentTag: el.parentElement?.tagName,
            inLink: !!el.closest('a'),
            linkHref: el.closest('a')?.getAttribute('href')
          });
        }
      });
      
      // ナビゲーション
      const nav = document.querySelector('nav');
      if (nav) {
        result.nav = {
          found: true,
          html: nav.innerHTML.substring(0, 500)
        };
      }
      
      return result;
    });
    
    console.log('\n📋 === リンク（最初の50個） ===');
    elements.links.forEach((link, i) => {
      if (link.ariaLabel || link.svgLabel || link.href?.includes('/create/')) {
        console.log(`\n[${i}]`);
        console.log(`  href: ${link.href || '(なし)'}`);
        console.log(`  aria-label: ${link.ariaLabel || '(なし)'}`);
        console.log(`  SVG: ${link.hasSVG ? link.svgLabel : 'なし'}`);
        console.log(`  text: ${link.text || '(なし)'}`);
      }
    });
    
    console.log('\n\n📋 === ボタン（最初の30個） ===');
    elements.buttons.forEach((btn, i) => {
      console.log(`\n[${i}]`);
      console.log(`  type: ${btn.type || '(なし)'}`);
      console.log(`  aria-label: ${btn.ariaLabel || '(なし)'}`);
      console.log(`  text: ${btn.text || '(なし)'}`);
    });
    
    console.log('\n\n📋 === SVG要素（最初の20個） ===');
    elements.svgs.forEach((svg, i) => {
      console.log(`\n[${i}]`);
      console.log(`  aria-label: ${svg.ariaLabel || '(なし)'}`);
      console.log(`  親: ${svg.parentTag}`);
      console.log(`  リンク内: ${svg.inLink ? `あり (${svg.linkHref})` : 'なし'}`);
    });
    
    console.log('\n\n📋 === ナビゲーション ===');
    if (elements.nav) {
      console.log('✅ ナビゲーション発見');
      console.log(elements.nav.html.substring(0, 300));
    } else {
      console.log('❌ ナビゲーション要素が見つかりません');
    }
    
    // スクリーンショット
    await page.screenshot({ path: '/tmp/instagram-cookie-debug.png', fullPage: true });
    console.log('\n📸 スクリーンショット: /tmp/instagram-cookie-debug.png');
    
    // HTML全体を保存
    const html = await page.content();
    fs.writeFileSync('/tmp/instagram-page.html', html);
    console.log('📄 HTML保存: /tmp/instagram-page.html');
    
  } finally {
    await browser.close();
  }
}

debugInstagram()
  .then(() => console.log('\n✅ デバッグ完了'))
  .catch(error => console.error('❌ エラー:', error));
