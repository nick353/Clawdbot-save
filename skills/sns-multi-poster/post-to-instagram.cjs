#!/usr/bin/env node
/**
 * Instagram 投稿エントリーポイント
 * 画像・動画を自動判定して適切なスクリプトを呼び出す
 * 
 * Usage: node post-to-instagram.cjs <media_path> <caption>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [,, mediaPath, caption] = process.argv;

if (!mediaPath || !caption) {
  console.error('使い方: node post-to-instagram.cjs <media_path> <caption>');
  process.exit(1);
}

if (!fs.existsSync(mediaPath)) {
  console.error(`❌ メディアファイルが見つかりません: ${mediaPath}`);
  process.exit(1);
}

// DRY_RUNモード確認
const isDryRun = process.env.DRY_RUN === 'true';

if (isDryRun) {
  console.log('🔄 DRY RUN: Instagram投稿スキップ');
  console.log(`📷 画像: ${mediaPath}`);
  console.log(`📝 キャプション: ${caption}`);
  console.log('✅ DRY RUN完了（実際の投稿なし）');
  process.exit(0);
}

// メディアタイプ判定
const ext = path.extname(mediaPath).toLowerCase();
const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(ext);
const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

if (!isVideo && !isImage) {
  console.error(`❌ サポートされていないファイル形式: ${ext}`);
  process.exit(1);
}

// 適切なスクリプトを呼び出し
let scriptPath;

if (isVideo) {
  scriptPath = path.join(__dirname, 'post-to-instagram-vision.cjs');
  console.log('🎥 動画投稿モード（Vision API統合版）');
} else {
  // 画像投稿用のスクリプトがない場合は、動画用スクリプトを流用
  // （多くのスクリプトは画像もサポート）
  scriptPath = path.join(__dirname, 'post-to-instagram-reels-v2-wait-completion.cjs');
  console.log('📷 画像投稿モード');
}

if (!fs.existsSync(scriptPath)) {
  console.error(`❌ 投稿スクリプトが見つかりません: ${scriptPath}`);
  process.exit(1);
}

try {
  // スクリプト実行
  execSync(`node "${scriptPath}" "${mediaPath}" "${caption}"`, {
    stdio: 'inherit',
    env: process.env
  });
  console.log('✅ Instagram投稿成功');
} catch (error) {
  console.error('❌ Instagram投稿失敗:', error.message);
  process.exit(1);
}
