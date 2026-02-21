#!/usr/bin/env node

/**
 * Google OAuth 認証スクリプト
 * Google Docs API と Google Sheets API にアクセスするためのトークンを取得
 */

const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// 認証情報のパス
const CREDENTIALS_PATH = path.join(__dirname, '../.google-credentials/credentials.json');
const TOKEN_PATH = path.join(__dirname, '../.google-credentials/token.json');

// アクセススコープ
const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

/**
 * OAuth クライアントを作成
 */
async function loadCredentials() {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = credentials.installed;
  
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * 認証URLを生成して表示
 */
async function authorize() {
  const oAuth2Client = await loadCredentials();
  
  // 既存のトークンをチェック
  try {
    const token = await fs.readFile(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    console.log('✅ 既存のトークンを使用します');
    return oAuth2Client;
  } catch (err) {
    // トークンがない場合は新規作成
    return getNewToken(oAuth2Client);
  }
}

/**
 * 新しいトークンを取得
 */
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  console.log('🔐 Google OAuth 認証が必要です');
  console.log('');
  console.log('以下のURLをブラウザで開いてください：');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('認証後、リダイレクトされたURL全体をコピーしてください');
  console.log('例: http://localhost/?code=4/0AanR...');
  console.log('');
  
  // ユーザー入力を待つ（対話モード）
  // VPS環境では手動で実行する必要がある
  
  return null;
}

/**
 * 認証コードからトークンを取得して保存
 */
async function saveToken(code) {
  const oAuth2Client = await loadCredentials();
  
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    
    // トークンを保存
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    console.log('✅ トークンを保存しました:', TOKEN_PATH);
    
    return oAuth2Client;
  } catch (err) {
    console.error('❌ トークン取得エラー:', err.message);
    throw err;
  }
}

// コマンドライン引数を処理
const args = process.argv.slice(2);

if (args[0] === 'save-token' && args[1]) {
  // 認証コードからトークンを保存
  const code = args[1];
  saveToken(code)
    .then(() => {
      console.log('');
      console.log('✅ 認証完了！Google Docs API が使えるようになりました');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ エラー:', err.message);
      process.exit(1);
    });
} else {
  // 認証URLを表示
  authorize()
    .then((auth) => {
      if (auth) {
        console.log('');
        console.log('✅ 認証済み！Google Docs API が使えます');
        process.exit(0);
      } else {
        console.log('');
        console.log('上記URLで認証した後、以下のコマンドを実行してください：');
        console.log('');
        console.log('  node scripts/google-auth.js save-token "http://localhost/?code=..."');
        console.log('');
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('❌ エラー:', err.message);
      process.exit(1);
    });
}
