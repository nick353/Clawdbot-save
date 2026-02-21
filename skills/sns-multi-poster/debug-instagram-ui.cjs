#!/usr/bin/env node
/**
 * Instagram UI構造調査スクリプト
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function debugInstagramUI() {
  const profileDir = path.join('/root/clawd/skills/sns-multi-poster', 'browser-profile');
  
  console.log('🔍 Instagram UI構造を調査中...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📋 === すべてのSVG要素 ===');
    const svgElements = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      return svgs.map((svg, index) => ({
        index,
        ariaLabel: svg.getAttribute('aria-label'),
        role: svg.getAttribute('role'),
        class: svg.className.baseVal,
        parentTag: svg.parentElement?.tagName,
        parentRole: svg.parentElement?.getAttribute('role'),
        parentAriaLabel: svg.parentElement?.getAttribute('aria-label'),
        href: svg.closest('a')?.getAttribute('href'),
        html: svg.outerHTML.substring(0, 200)
      }));
    });
    
    svgElements.forEach(el => {
      console.log(`\n[${el.index}]`);
      console.log(`  aria-label: ${el.ariaLabel || '(なし)'}`);
      console.log(`  親タグ: ${el.parentTag} (role: ${el.parentRole || '(なし)'})`);
      console.log(`  親aria-label: ${el.parentAriaLabel || '(なし)'}`);
      console.log(`  href: ${el.href || '(なし)'}`);
    });
    
    console.log('\n\n📋 === すべてのリンク ===');
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      return allLinks
        .map((link, index) => ({
          index,
          href: link.getAttribute('href'),
          ariaLabel: link.getAttribute('aria-label'),
          role: link.getAttribute('role'),
          text: link.innerText?.substring(0, 50),
          hasSVG: link.querySelector('svg') !== null,
          svgAriaLabel: link.querySelector('svg')?.getAttribute('aria-label')
        }))
        .filter(l => l.href || l.ariaLabel);
    });
    
    links.forEach(link => {
      console.log(`\n[${link.index}]`);
      console.log(`  href: ${link.href || '(なし)'}`);
      console.log(`  aria-label: ${link.ariaLabel || '(なし)'}`);
      console.log(`  text: ${link.text || '(なし)'}`);
      console.log(`  SVG: ${link.hasSVG ? `あり (${link.svgAriaLabel})` : 'なし'}`);
    });
    
    console.log('\n\n📋 === ナビゲーション要素 ===');
    const navElements = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return { found: false };
      
      const items = Array.from(nav.querySelectorAll('a, span[role="link"]'));
      return {
        found: true,
        items: items.map((item, index) => ({
          index,
          tag: item.tagName,
          href: item.getAttribute('href'),
          ariaLabel: item.getAttribute('aria-label'),
          role: item.getAttribute('role'),
          text: item.innerText?.substring(0, 50),
          hasSVG: item.querySelector('svg') !== null,
          svgAriaLabel: item.querySelector('svg')?.getAttribute('aria-label')
        }))
      };
    });
    
    if (navElements.found) {
      navElements.items.forEach(item => {
        console.log(`\n[${item.index}] ${item.tag}`);
        console.log(`  href: ${item.href || '(なし)'}`);
        console.log(`  aria-label: ${item.ariaLabel || '(なし)'}`);
        console.log(`  text: ${item.text || '(なし)'}`);
        console.log(`  SVG: ${item.hasSVG ? `あり (${item.svgAriaLabel})` : 'なし'}`);
      });
    } else {
      console.log('  ❌ ナビゲーション要素が見つかりません');
    }
    
    // スクリーンショット保存
    await page.screenshot({ path: '/tmp/instagram-ui-debug.png', fullPage: true });
    console.log('\n📸 スクリーンショット保存: /tmp/instagram-ui-debug.png');
    
  } finally {
    await browser.close();
  }
}

debugInstagramUI()
  .then(() => console.log('\n✅ 調査完了'))
  .catch(error => console.error('❌ エラー:', error));
