#!/usr/bin/env node
/**
 * Instagram Graph API 投稿スクリプト
 * IG_API_TOKEN を使って直接 API で投稿
 * 
 * Usage: node post-to-instagram-graph-api.cjs <image_path> <caption>
 * 環境変数: IG_API_TOKEN（必須）、IG_BUSINESS_ACCOUNT_ID（必須）
 * 
 * Instagram Graph API 投稿フロー:
 * 1. POST /me/media - コンテナ作成（画像URL + キャプション）
 * 2. POST /me/media_publish - コンテナを公開
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const querystring = require('querystring');

const [, , imagePath, caption] = process.argv;

// 引数チェック
if (!imagePath || !caption) {
  console.error('使い方: node post-to-instagram-graph-api.cjs <image_path> <caption>');
  console.error('環境変数: IG_API_TOKEN (必須), IG_BUSINESS_ACCOUNT_ID (必須)');
  process.exit(1);
}

// 環境変数チェック
const apiToken = process.env.IG_API_TOKEN;
const businessAccountId = process.env.IG_BUSINESS_ACCOUNT_ID;

if (!apiToken) {
  console.error('❌ 環境変数 IG_API_TOKEN が設定されていません');
  console.error('取得方法: https://developers.facebook.com/docs/instagram-api/getting-started');
  process.exit(1);
}

if (!businessAccountId) {
  console.error('❌ 環境変数 IG_BUSINESS_ACCOUNT_ID が設定されていません');
  console.error('取得方法: Facebook Graph API Explorer で GET /me/accounts → instagram_business_account');
  process.exit(1);
}

const apiVersion = 'v18.0';

// DRY RUN チェック
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Instagram投稿スキップ');
  console.log(`📷 画像: ${imagePath}`);
  console.log(`📝 キャプション: ${caption.substring(0, 100)}`);
  console.log(`🔗 API Token: ${apiToken.substring(0, 20)}...`);
  console.log(`👤 Business Account ID: ${businessAccountId}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

// 画像ファイル確認
if (!fs.existsSync(imagePath)) {
  console.error(`❌ 画像が見つかりません: ${imagePath}`);
  process.exit(1);
}

/**
 * 画像を公開URLにアップロード（Cloudinary, Imgur, 自前サーバーなど）
 * Instagram Graph API は画像URLが必要
 */
async function uploadImageToPublicUrl(filePath) {
  // 簡易的な実装: ローカルHTTPサーバーを立ち上げて公開URL化
  // 本番環境では Cloudinary / Imgur / S3 などを使用
  
  console.log('📤 画像を公開URLにアップロード中...');
  
  // TODO: Cloudinary などの実装
  // 今回は Cloudinary を使う（CLOUDINARY_* 環境変数が必要）
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudApiSecret = process.env.CLOUDINARY_API_SECRET;
  
  if (!cloudName || !cloudApiKey || !cloudApiSecret) {
    console.error('❌ Cloudinary 認証情報が設定されていません');
    console.error('必要な環境変数: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    process.exit(1);
  }
  
  // Cloudinary にアップロード
  const FormData = require('form-data');
  const form = new FormData();
  
  form.append('file', fs.createReadStream(filePath));
  form.append('upload_preset', 'ml_default'); // または設定したプリセット
  
  return new Promise((resolve, reject) => {
    form.submit(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, (err, res) => {
      if (err) {
        console.error('❌ Cloudinary アップロードエラー:', err.message);
        return reject(err);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.secure_url) {
            console.log('✅ Cloudinary アップロード成功:', result.secure_url);
            resolve(result.secure_url);
          } else {
            console.error('❌ Cloudinary レスポンスエラー:', result);
            reject(new Error('Cloudinary upload failed'));
          }
        } catch (parseErr) {
          console.error('❌ Cloudinary レスポンス解析エラー:', parseErr.message);
          reject(parseErr);
        }
      });
    });
  });
}

/**
 * Instagram Graph API リクエスト
 */
function makeApiRequest(method, endpoint, params) {
  return new Promise((resolve, reject) => {
    const queryParams = querystring.stringify(params);
    const url = `https://graph.facebook.com/${apiVersion}/${endpoint}?${queryParams}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      }
    };
    
    console.log(`📡 API Request: ${method} ${url.substring(0, 100)}...`);
    
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            console.error('❌ API エラーレスポンス:', result);
            reject(new Error(result.error?.message || 'API request failed'));
          }
        } catch (parseErr) {
          console.error('❌ API レスポンス解析エラー:', parseErr.message);
          console.error('Raw response:', data);
          reject(parseErr);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ API リクエストエラー:', err.message);
      reject(err);
    });
    
    req.end();
  });
}

async function main() {
  try {
    console.log('🐥 Instagram Graph API 投稿開始');
    console.log(`📷 画像: ${imagePath}`);
    console.log(`📝 キャプション: ${caption.substring(0, 100)}${caption.length > 100 ? '...' : ''}`);
    
    // Step 1: 画像を公開URLにアップロード
    const imageUrl = await uploadImageToPublicUrl(imagePath);
    
    // Step 2: Instagram コンテナ作成
    console.log('\n📦 Step 1: コンテナ作成中...');
    const createParams = {
      image_url: imageUrl,
      caption: caption,
      access_token: apiToken
    };
    
    const createResponse = await makeApiRequest('POST', `${businessAccountId}/media`, createParams);
    const containerId = createResponse.id;
    
    if (!containerId) {
      throw new Error('Container ID not returned from API');
    }
    
    console.log(`✅ コンテナ作成成功: ${containerId}`);
    
    // Step 3: コンテナを公開
    console.log('\n📤 Step 2: コンテナ公開中...');
    const publishParams = {
      creation_id: containerId,
      access_token: apiToken
    };
    
    const publishResponse = await makeApiRequest('POST', `${businessAccountId}/media_publish`, publishParams);
    const mediaId = publishResponse.id;
    
    if (!mediaId) {
      throw new Error('Media ID not returned from publish API');
    }
    
    console.log(`✅ 投稿成功: ${mediaId}`);
    console.log(`🔗 投稿URL: https://www.instagram.com/p/${mediaId}/`);
    
    // 成功結果を返す
    console.log('\n🎉 Instagram Graph API 投稿完了！');
    
  } catch (error) {
    console.error('\n❌ エラー発生:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

main();
