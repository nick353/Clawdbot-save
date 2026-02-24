#!/bin/bash
# HyperAgent実行に必要な環境変数チェック

echo "🔍 HyperAgent環境変数チェック"
echo ""

# 必須変数（いずれか1つ以上）
LLM_KEYS=("GEMINI_API_KEY" "ANTHROPIC_API_KEY" "OPENAI_API_KEY")
LLM_KEY_FOUND=false

echo "🤖 LLM API Key:"
for VAR in "${LLM_KEYS[@]}"; do
  if [ -n "${!VAR}" ]; then
    echo "✅ $VAR: ${!VAR:0:10}... (設定済み)"
    LLM_KEY_FOUND=true
  fi
done

if [ "$LLM_KEY_FOUND" = false ]; then
  echo "❌ LLM API Key が設定されていません（GEMINI_API_KEY/ANTHROPIC_API_KEY/OPENAI_API_KEY のいずれか）"
  ALL_OK=false
fi

echo ""
echo "📱 Instagram認証情報:"
if [ -z "$IG_PASSWORD" ]; then
  echo "❌ IG_PASSWORD が設定されていません"
  ALL_OK=false
else
  echo "✅ IG_PASSWORD: ${IG_PASSWORD:0:10}... (設定済み)"
fi

ALL_OK=true
if [ "$LLM_KEY_FOUND" = false ] || [ -z "$IG_PASSWORD" ]; then
  ALL_OK=false
fi

# オプション変数
echo ""
echo "📋 オプション変数:"
if [ -n "$IG_USERNAME" ]; then
  echo "✅ IG_USERNAME: $IG_USERNAME"
else
  echo "⚠️ IG_USERNAME が設定されていません（デフォルト値を使用）"
fi

echo ""
if [ "$ALL_OK" = true ]; then
  echo "✅ 全ての必須変数が設定されています"
  exit 0
else
  echo "❌ 一部の環境変数が不足しています"
  exit 1
fi
