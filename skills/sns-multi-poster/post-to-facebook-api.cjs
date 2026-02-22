#!/usr/bin/env node
/**
 * Facebook Graph API 投稿スクリプト
 * FACEBOOK_API_TOKEN を使って直接 API で投稿
 * 
 * Usage: node post-to-facebook-api.cjs <image_path> <caption>
 * 環境変数: FACEBOOK_API_TOKEN（必須）、PAGE_ID（オプション）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const [, , imagePath, caption] = process.argv;

// 引数チェック
if (!imagePath || !caption) {
  console.error('使い方: node post-to-facebook-api.cjs <image_path> <caption>');
  console.error('環境変数: FACEBOOK_API_TOKEN (必須), PAGE_ID (オプション - デフォルト: "me")');
  process.exit(1);
}

// 環境変数チェック
const apiToken = process.env.FACEBOOK_API_TOKEN;
if (!apiToken) {
  console.error('❌ 環境変数 FACEBOOK_API_TOKEN が設定されていません');
  process.exit(1);
}

const pageId = process.env.PAGE_ID || 'me';
const apiVersion = 'v18.0';

// DRY RUN チェック
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Facebook投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 100)}`);
  console.log(`🔗 API Token: ${apiToken.substring(0, 20)}...`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

// 画像ファイル確認
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

// マルチパート/フォームデータを手動で構築
function buildMultipartFormData(filePath, caption, token) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  let formData = '';
  
  // caption フィールド
  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="caption"\r\n\r\n`;
  formData += `${caption}\r\n`;

  // source フィールド（ファイル）
  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="source"; filename="${fileName}"\r\n`;
  formData += `Content-Type: image/jpeg\r\n\r\n`;

  const header = Buffer.from(formData);
  const footer = Buffer.from(`\r\n--${boundary}\r\n`);
  const body = Buffer.concat([header, fileData, footer]);

  return { body, boundary };
}

async function postToFacebook() {
  console.log('📘 Facebook Graph API で投稿開始');
  console.log(`🖼️  ${imagePath}`);
  console.log(`📝 ${caption.substring(0, 100)}`);

  return new Promise((resolve, reject) => {
    try {
      const { body, boundary } = buildMultipartFormData(imagePath, caption, apiToken);

      const url = new URL(`https://graph.facebook.com/${apiVersion}/${pageId}/photos`);
      url.searchParams.append('access_token', apiToken);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary.substring(2)}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('✅ Facebook 投稿完了！');
              console.log(`📌 Photo ID: ${result.id}`);
              resolve(result);
            } else {
              const errorMsg = result.error?.message || data;
              console.error(`❌ Facebook API エラー (${res.statusCode}): ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          } catch (e) {
            console.error(`❌ レスポンス解析エラー: ${e.message}`);
            console.error(`📋 レスポンス: ${data.substring(0, 200)}`);
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        console.error(`❌ リクエストエラー: ${e.message}`);
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    } catch (e) {
      console.error(`❌ エラー: ${e.message}`);
      reject(e);
    }
  });
}

postToFacebook()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
