#!/usr/bin/env node
/**
 * Cookie変換スクリプト (Puppeteer形式 → Playwright形式)
 */

const fs = require('fs');
const path = require('path');

const cookiesDir = path.join(__dirname, 'cookies');
const cookieFiles = ['instagram.json', 'threads.json', 'facebook.json', 'pinterest.json', 'x.json'];

cookieFiles.forEach(file => {
  const cookiePath = path.join(cookiesDir, file);
  
  if (!fs.existsSync(cookiePath)) {
    console.log(`⏭️  スキップ: ${file} (ファイルなし)`);
    return;
  }
  
  try {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
    
    const fixedCookies = cookies.map(cookie => {
      // sameSite 変換
      if (cookie.sameSite === 'unspecified') {
        cookie.sameSite = 'Lax';
      } else if (cookie.sameSite === 'no_restriction') {
        cookie.sameSite = 'None';
      } else if (cookie.sameSite && !['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
        cookie.sameSite = 'Lax';
      }
      
      // expirationDate → expires (Playwright形式)
      if (cookie.expirationDate) {
        cookie.expires = Math.floor(cookie.expirationDate);
        delete cookie.expirationDate;
      }
      
      // 不要なプロパティを削除
      delete cookie.hostOnly;
      delete cookie.session;
      delete cookie.storeId;
      delete cookie.id;
      
      return cookie;
    });
    
    // バックアップ
    const backupPath = cookiePath + '.backup';
    fs.copyFileSync(cookiePath, backupPath);
    
    // 上書き
    fs.writeFileSync(cookiePath, JSON.stringify(fixedCookies, null, 2));
    
    console.log(`✅ 修正完了: ${file} (${fixedCookies.length} cookies)`);
  } catch (error) {
    console.error(`❌ エラー: ${file} - ${error.message}`);
  }
});

console.log('\n✅ 全Cookie修正完了');
