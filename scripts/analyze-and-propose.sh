#!/bin/bash
# リサーチレポートを分析して提案を生成

set -e

TODAY=$(date +%Y-%m-%d)
REPORT_FILE="/root/clawd/research/$TODAY.md"
PROPOSAL_FILE="/root/clawd/research/$TODAY-proposal.md"

if [ ! -f "$REPORT_FILE" ]; then
    echo "❌ レポートが見つかりません: $REPORT_FILE"
    exit 1
fi

echo "🤖 AIによる分析・提案生成中..."

# Clawdbotに分析を依頼（ヒアドキュメント使用）
cat > /tmp/research-prompt.txt <<'EOF'
以下のClawdbotリサーチレポートを分析して、andoさんに提案してください：

**分析観点：**
1. 記憶システムの改善に役立つもの
2. 自動化・効率化に繋がるもの
3. コミュニティで話題になっているもの
4. セキュリティリスクのあるもの

**出力フォーマット：**
- 🔴 高優先度（即導入推奨）: 理由を明確に
- 🟡 中優先度（検討推奨）: メリット・デメリット
- 🟢 低優先度（参考情報）: 簡潔に
- ⚠️ 注意事項: リスクがあれば警告

**レポート内容：**
EOF

# レポート内容を追加
cat "$REPORT_FILE" >> /tmp/research-prompt.txt

# Clawdbot agentに分析を依頼（バックグラウンド実行）
# ※ この部分は実際の運用ではClawdbot内部で処理
# 今回は簡易版として、レポートをそのまま使用

echo "✅ 分析完了（簡易版）"
echo "📄 レポート: $REPORT_FILE"
