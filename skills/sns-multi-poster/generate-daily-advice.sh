#!/bin/bash
# generate-daily-advice.sh - ログ出力最適化版

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCORD_CHANNEL_ID="1470060780111007950"
DATE_STR=$(date '+%Y%m%d')
YESTERDAY=$(date -d 'yesterday' '+%Y%m%d' 2>/dev/null || date -v-1d '+%Y%m%d' 2>/dev/null || echo "$DATE_STR")
BUZZ_DIR="/root/clawd/data/buzz"
PERF_DIR="/root/clawd/data/sns-performance"
ADVICE_SCRIPT="/tmp/generate_advice_$$.js"

cat > "$ADVICE_SCRIPT" << 'JSEOF'
const fs = require('fs');
const { execSync } = require('child_process');

const BUZZ_DIR = '/root/clawd/data/buzz';
const PERF_DIR = '/root/clawd/data/sns-performance';
const DISCORD_CHANNEL_ID = '1470060780111007950';

// 引数から日付を取得
const yesterday = process.argv[2] || new Date(Date.now() - 86400000).toISOString().slice(0,10).replace(/-/g,'');
const today = process.argv[3] || new Date().toISOString().slice(0,10).replace(/-/g,'');

function readJSON(path) {
  try {
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch(e) {}
  return null;
}

// バズデータを読む（昨日または今日）
function readBuzz(platform) {
  return readJSON(`${BUZZ_DIR}/${platform}_${yesterday}.json`) ||
         readJSON(`${BUZZ_DIR}/${platform}_${today}.json`) || null;
}

// パフォーマンスデータを読む
function readPerf(platform) {
  return readJSON(`${PERF_DIR}/${platform}_${yesterday}.json`) ||
         readJSON(`${PERF_DIR}/${platform}_${today}.json`) || null;
}

const igBuzz = readBuzz('instagram');
const xBuzz  = readBuzz('x');
const ptBuzz = readBuzz('pinterest');
const thBuzz = readBuzz('threads');

const igPerf = readPerf('instagram');
const xPerf  = readPerf('x');
const ptPerf = readPerf('pinterest');
const thPerf = readPerf('threads');

// バズサマリー生成
function buzzSummary(data, platform) {
  if (!data || data.error || (data.totalPosts === 0 && data.totalPins === 0)) {
    return `【${platform}】データ収集中`;
  }
  const max = data.maxLikes || data.maxSaves || 0;
  const total = data.totalPosts || data.totalPins || 0;
  const metric = platform === 'Pinterest' ? '最高保存' : '最高いいね';
  return `【${platform}】${metric}: ${max}件 (${total}件調査)`;
}

// パフォーマンスサマリー
function perfSummary(data, platform) {
  if (!data || data.error) return `【${platform}】データなし`;
  const posts = data.posts || data.pins || [];
  if (posts.length === 0) return `【${platform}】投稿データなし`;
  const avg = data.avgLikes || data.avgSaves || 0;
  const max = data.maxLikes || data.maxSaves || 0;
  return `【${platform}】平均: ${avg} / 最高: ${max} (${posts.length}件)`;
}

// トレンドパターン分析
function analyzePatterns(buzzData, platform) {
  if (!buzzData) return 'データなし';
  const posts = buzzData.posts || buzzData.pins || [];
  if (posts.length === 0) return 'データ収集中';

  const topPosts = posts.slice(0, 3);
  const patterns = [];

  // ハッシュタグ分析
  const hashtags = {};
  topPosts.forEach(p => {
    const text = p.text || p.description || p.alt || '';
    const tags = text.match(/#\w+/g) || [];
    tags.forEach(t => { hashtags[t] = (hashtags[t] || 0) + 1; });
  });
  const topTags = Object.entries(hashtags).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);
  if (topTags.length > 0) patterns.push(`人気タグ: ${topTags.join(' ')}`);

  // テキスト長分析
  const avgLen = topPosts.reduce((s, p) => s + (p.text || p.description || '').length, 0) / (topPosts.length || 1);
  if (avgLen > 200) patterns.push('長文キャプション傾向');
  else if (avgLen < 50) patterns.push('短文・シンプルキャプション傾向');

  // 絵文字の有無
  const emojiCount = topPosts.filter(p => /[\u{1F300}-\u{1F9FF}]/u.test(p.text || p.description || '')).length;
  if (emojiCount > topPosts.length / 2) patterns.push('絵文字多用');

  return patterns.length > 0 ? patterns.join(' / ') : 'パターン分析中';
}

// 今日の最適ハッシュタグ
const UKIYOE_HASHTAGS = [
  '#浮世絵', '#ukiyoe', '#japanart', '#japaneseprint', '#woodblockprint',
  '#japaneseart', '#traditionalart', '#artprint', '#vintageart', '#orientalart',
  '#hokusai', '#hiroshige', '#utamaro', '#edo', '#meiji',
  '#nihonga', '#tokyoart', '#asianart', '#printmaking', '#artcollector'
];

// データ件数チェック（7件未満はスキップ）
const totalData = (igBuzz?.totalPosts || 0) + (xBuzz?.totalPosts || 0) + (ptBuzz?.totalPins || 0);
const insufficientData = totalData < 7;

// アドバイス生成
const advices = [];
if (!insufficientData) {
  // Instagram分析
  if (igBuzz && igBuzz.totalPosts > 0) {
    const topIG = (igBuzz.posts || []).slice(0, 1)[0];
    if (topIG && topIG.likes > 100) {
      advices.push(`Instagram最高いいね投稿を参考に、${analyzePatterns(igBuzz, 'Instagram')}`);
    }
  }
  // X分析
  if (xBuzz && xBuzz.totalPosts > 0) {
    advices.push(`X(Twitter)では${analyzePatterns(xBuzz, 'X')}が効果的`);
  }
  // Pinterest分析
  if (ptBuzz && ptBuzz.totalPins > 0) {
    advices.push(`Pinterestでは縦長画像・詳細な説明文が保存数増加に効果的`);
  }

  // 自分のパフォーマンスとの差分
  const myAvg = igPerf?.avgLikes || 0;
  const buzzMax = igBuzz?.maxLikes || 0;
  if (buzzMax > myAvg * 3) {
    advices.push(`バズ投稿のいいね数は自分の平均の${Math.round(buzzMax/Math.max(myAvg,1))}倍。ハッシュタグ・投稿時間を見直すと効果的`);
  }
} else {
  advices.push('引き続きデータ収集中です。バズ調査を毎日実行してデータを蓄積しましょう');
  advices.push('Instagram投稿は毎日21:00-23:00 JST頃が最もエンゲージメントが高い傾向');
  advices.push('浮世絵作品は高品質な画像・詳細な作品説明・英語ハッシュタグ併用が効果的');
}

const message = `🌅 今日のSNS改善提案
━━━━━━━━━━━━━━━━
📊 昨日のバズ投稿分析

${buzzSummary(igBuzz, 'Instagram')}
${igBuzz && !igBuzz.error ? `✅ トレンドパターン: ${analyzePatterns(igBuzz, 'Instagram')}` : ''}

${buzzSummary(xBuzz, 'X')}
${xBuzz && !xBuzz.error ? `✅ トレンドパターン: ${analyzePatterns(xBuzz, 'X')}` : ''}

${buzzSummary(ptBuzz, 'Pinterest')}
${ptBuzz && !ptBuzz.error ? `✅ トレンドパターン: ${analyzePatterns(ptBuzz, 'Pinterest')}` : ''}

📈 自分のパフォーマンス
${perfSummary(igPerf, 'Instagram')}
${perfSummary(xPerf, 'X')}
${perfSummary(ptPerf, 'Pinterest')}

💡 今日の投稿アドバイス
${advices.map(a => `→ ${a}`).join('\n')}

#今日のコピペ用ハッシュタグ
${UKIYOE_HASHTAGS.join(' ')}`;

console.log(message);

// Discordに送信
try {
  const escaped = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  execSync(`clawdbot message send --channel discord --target "${DISCORD_CHANNEL_ID}" --message "${escaped}"`, {
    timeout: 30000,
    stdio: 'inherit'
  });
} catch(e) {
  // フォールバック: ファイル経由
  const tmpFile = `/tmp/advice_msg_${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, message);
  try {
    execSync(`clawdbot message send --channel discord --target "${DISCORD_CHANNEL_ID}" --message "$(cat ${tmpFile})"`, {
      timeout: 30000,
      shell: '/bin/bash',
      stdio: 'inherit'
    });
  } catch(e2) {
    console.error('Discord送信失敗:', e2.message);
  }
  fs.unlinkSync(tmpFile);
}

// アドバイスをファイルにも保存
const adviceFile = `/root/clawd/data/buzz/advice_${today}.json`;
fs.writeFileSync(adviceFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  date: today,
  igBuzzMax: igBuzz?.maxLikes || 0,
  xBuzzMax: xBuzz?.maxLikes || 0,
  ptBuzzMax: ptBuzz?.maxSaves || 0,
  myIgAvg: igPerf?.avgLikes || 0,
  advices,
  message,
}, null, 2));

console.log(`\n✅ アドバイス生成・保存完了: ${adviceFile}`);
process.exit(0);
JSEOF

node "$ADVICE_SCRIPT" "$YESTERDAY" "$DATE_STR" 2>/dev/null
EXIT_CODE=$?
rm -f "$ADVICE_SCRIPT"
[ $EXIT_CODE -ne 0 ] && echo "❌ 改善提案生成エラー" >&2
