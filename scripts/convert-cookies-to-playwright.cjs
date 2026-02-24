#!/usr/bin/env node

/**
 * Cookie形式をPlaywright互換に変換
 */

const fs = require('fs');

function convertCookies(inputPath, outputPath) {
  const cookies = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  
  const converted = cookies.map(cookie => {
    // sameSite変換（大文字に正規化）
    let sameSite = cookie.sameSite || 'Lax';
    if (sameSite === 'unspecified') sameSite = 'Lax';
    if (sameSite === 'no_restriction') sameSite = 'None';
    
    // 小文字を大文字に正規化
    if (sameSite.toLowerCase() === 'lax') sameSite = 'Lax';
    if (sameSite.toLowerCase() === 'none') sameSite = 'None';
    if (sameSite.toLowerCase() === 'strict') sameSite = 'Strict';
    
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: sameSite
    };
  });
  
  fs.writeFileSync(outputPath, JSON.stringify(converted, null, 2));
  console.log(`✅ Converted ${cookies.length} cookies`);
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node convert-cookies-to-playwright.js <input.json> <output.json>');
    process.exit(1);
  }
  
  convertCookies(args[0], args[1]);
}

module.exports = { convertCookies };
