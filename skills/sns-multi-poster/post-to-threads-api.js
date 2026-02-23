#!/usr/bin/env node
/**
 * Threads API 投稿スクリプト
 * 
 * Usage: node post-to-threads-api.js <image_url> <caption>
 * OR (ローカルファイル): node post-to-threads-api.js <local_image_path> <caption>
 * 
 * 環境変数:
 *   - THREADS_ACCESS_TOKEN: Threads API アクセストークン
 *   - THREADS_USER_ID: Threads ユーザーID
 *   - CLOUDINARY_CLOUD_NAME: Cloudinary クラウド名 (ローカルファイル用)
 *   - CLOUDINARY_API_KEY: Cloudinary API キー (ローカルファイル用)
 *   - CLOUDINARY_API_SECRET: Cloudinary API シークレット (ローカルファイル用)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios').default;

const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const THREADS_USER_ID = process.env.THREADS_USER_ID;

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// コマンドラインパラメータ
const [, , imagePathOrUrl, caption] = process.argv;

if (!imagePathOrUrl || !caption) {
  console.error('使い方: node post-to-threads-api.js <image_url|local_path> <caption>');
  process.exit(1);
}

if (!THREADS_ACCESS_TOKEN || !THREADS_USER_ID) {
  console.error('❌ エラー: THREADS_ACCESS_TOKEN と THREADS_USER_ID が必要です');
  process.exit(1);
}

// DRY RUN チェック（早期終了）
if (process.env.DRY_RUN === 'true') {
  console.log('🔄 DRY RUN: Threads API 投稿スキップ');
  console.log(`📷 画像: ${imagePathOrUrl}`);
  console.log(`📝 キャプション: ${caption.substring(0, 80)}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

async function uploadToCloudinary(imagePath) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary認証情報が設定されていません');
  }

  console.log(`📤 Cloudinary にアップロード中: ${imagePath}`);

  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  form.append('upload_preset', 'sns_auto_post');
  form.append('api_key', CLOUDINARY_API_KEY);

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      form,
      { headers: form.getHeaders() }
    );

    const imageUrl = response.data.secure_url;
    console.log(`✅ Cloudinary アップロード成功: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('❌ Cloudinary アップロード失敗:', error.message);
    throw error;
  }
}

async function postToThreadsAPI(imageUrl, text) {
  console.log('🧵 Threads API に投稿中...');

  // Step 1: メディアコンテナを作成
  const createMediaUrl = `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads`;
  const params = {
    media_type: 'IMAGE',
    image_url: imageUrl,
    text: text,
    access_token: THREADS_ACCESS_TOKEN,
  };

  const createMediaQuery = new URLSearchParams(params).toString();

  try {
    console.log('📦 メディアコンテナを作成中...');
    
    const response = await new Promise((resolve, reject) => {
      const options = new URL(`${createMediaUrl}?${createMediaQuery}`);
      
      https.post(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      }).on('error', reject);
    });

    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }

    const mediaContainerId = response.id;
    console.log(`✅ メディアコンテナ作成成功: ${mediaContainerId}`);

    // Step 2: メディアを公開
    const publishUrl = `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads_publish`;
    const publishParams = {
      creation_id: mediaContainerId,
      access_token: THREADS_ACCESS_TOKEN,
    };

    const publishQuery = new URLSearchParams(publishParams).toString();

    console.log('📤 投稿を公開中...');

    const publishResponse = await new Promise((resolve, reject) => {
      const options = new URL(`${publishUrl}?${publishQuery}`);
      
      https.post(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      }).on('error', reject);
    });

    if (publishResponse.error) {
      throw new Error(`Publish API Error: ${publishResponse.error.message}`);
    }

    const postId = publishResponse.id;
    console.log(`\n✅ Threads に投稿成功！`);
    console.log(`🔗 投稿ID: ${postId}`);
    console.log(`👤 @${process.env.THREADS_USERNAME || 'threads_user'}`);
    console.log(`📝 ${text.substring(0, 100)}...`);

  } catch (error) {
    console.error('❌ Threads API 投稿失敗:', error.message);
    throw error;
  }
}

async function main() {
  try {
    let imageUrl = imagePathOrUrl;

    // ローカルファイルパスの場合、Cloudinary にアップロード
    if (!imagePathOrUrl.startsWith('http://') && !imagePathOrUrl.startsWith('https://')) {
      if (!fs.existsSync(imagePathOrUrl)) {
        console.error(`❌ エラー: 画像ファイルが見つかりません: ${imagePathOrUrl}`);
        process.exit(1);
      }
      imageUrl = await uploadToCloudinary(imagePathOrUrl);
    }

    // Threads API に投稿
    await postToThreadsAPI(imageUrl, caption);

  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main();
