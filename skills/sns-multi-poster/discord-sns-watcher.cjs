#!/usr/bin/env node
/**
 * Discord #sns-投稿チャンネル監視bot
 * メディア投稿を検出 → Gemini分析 → 5つのSNSに自動投稿
 */

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 設定
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const SNS_CHANNEL_ID = '1470060780111007950'; // #sns-投稿
const TEMP_DIR = '/tmp/sns-auto-poster';
const SCRIPT_DIR = __dirname;

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Discord client初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// メディアダウンロード
async function downloadMedia(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// メディア投稿を検出 → 自動SNS投稿
async function handleMediaPost(message) {
  const attachments = Array.from(message.attachments.values());
  
  if (attachments.length === 0) {
    console.log('⏭️  添付ファイルなし、スキップ');
    return;
  }
  
  console.log(`📎 ${attachments.length}件のメディアを検出`);
  
  for (const attachment of attachments) {
    const { url, name } = attachment;
    
    // 画像・動画のみ処理
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    const isVideo = /\.(mp4|mov|avi|mkv)$/i.test(name);
    
    if (!isImage && !isVideo) {
      console.log(`⏭️  スキップ: ${name}（画像・動画以外）`);
      continue;
    }
    
    const mediaType = isVideo ? '動画' : '画像';
    console.log(`🔽 ダウンロード中: ${name} (${mediaType})`);
    
    try {
      // ダウンロード
      const localPath = path.join(TEMP_DIR, name);
      await downloadMedia(url, localPath);
      console.log(`✅ ダウンロード完了: ${localPath}`);
      
      // 自動SNS投稿スクリプト実行
      console.log(`🚀 自動SNS投稿開始...`);
      
      // DRY_RUNモード
      const dryRun = process.env.DRY_RUN === 'true' ? 'DRY_RUN=true ' : '';
      
      const { stdout, stderr } = await execAsync(
        `${dryRun}bash "${SCRIPT_DIR}/auto-sns-poster.sh" "${url}" "${localPath}"`,
        { timeout: 600000 } // 10分タイムアウト
      );
      
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      console.log(`✅ 自動SNS投稿完了: ${name}`);
      
      // 一時ファイル削除
      fs.unlinkSync(localPath);
      
    } catch (err) {
      console.error(`❌ 処理失敗: ${name}`, err.message);
      
      // エラーをDiscordに投稿
      try {
        await message.channel.send(
          `❌ **自動SNS投稿エラー**\n` +
          `📎 ファイル: \`${name}\`\n` +
          `⚠️ エラー: ${err.message}`
        );
      } catch (sendErr) {
        console.error('Discord通知失敗:', sendErr);
      }
    }
  }
}

// Discordイベントハンドラー
client.on('ready', () => {
  console.log(`✅ Discord bot起動: ${client.user.tag}`);
  console.log(`👀 #sns-投稿チャンネルを監視中... (ID: ${SNS_CHANNEL_ID})`);
});

client.on('messageCreate', async (message) => {
  // 自分のメッセージは無視
  if (message.author.bot) return;
  
  // #sns-投稿チャンネルのみ処理
  if (message.channel.id !== SNS_CHANNEL_ID) return;
  
  console.log(`📨 新規投稿検出: ${message.author.tag}`);
  
  try {
    await handleMediaPost(message);
  } catch (err) {
    console.error('❌ メディア処理エラー:', err);
  }
});

client.on('error', (err) => {
  console.error('❌ Discord client error:', err);
});

// Bot起動
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error('❌ Discord login failed:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  client.destroy();
  process.exit(0);
});
