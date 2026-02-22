#!/bin/bash

################################################################################
# memory-semantic-optimizer.sh
# セマンティック検索品質最適化スクリプト
#
# 機能:
#  - ハイブリッド検索（semantic + keyword）
#  - クエリ拡張（曖昧なクエリを自動展開）
#  - 関連度スコアでリランキング
#
# 使用例:
#  bash memory-semantic-optimizer.sh "ユーザーの決定事項" --hybrid --expand --rerank
#  bash memory-semantic-optimizer.sh "過去のプロジェクト" --hybrid
################################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定
QUERY="${1:-}"
HYBRID_MODE=false
EXPAND_QUERY=false
RERANK_RESULTS=false

# 引数パース
while [[ $# -gt 1 ]]; do
  case "$2" in
    --hybrid)
      HYBRID_MODE=true
      shift
      ;;
    --expand)
      EXPAND_QUERY=true
      shift
      ;;
    --rerank)
      RERANK_RESULTS=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# バリデーション
if [[ -z "$QUERY" ]]; then
  echo -e "${RED}❌ エラー: クエリを指定してください${NC}"
  echo "使用例: bash memory-semantic-optimizer.sh \"検索クエリ\" --hybrid --expand --rerank"
  exit 1
fi

echo -e "${BLUE}🔍 セマンティック検索最適化スクリプト${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "クエリ: ${YELLOW}${QUERY}${NC}"
echo -e "モード: $([ "$HYBRID_MODE" = true ] && echo "ハイブリッド検索 ✓" || echo "semantic検索") | $([ "$EXPAND_QUERY" = true ] && echo "クエリ拡張 ✓" || echo "拡張なし") | $([ "$RERANK_RESULTS" = true ] && echo "リランキング ✓" || echo "リランキングなし")"
echo ""

# ================================================================================
# ステップ1: クエリ拡張
# ================================================================================

ORIGINAL_QUERY="$QUERY"
EXPANDED_QUERIES=("$ORIGINAL_QUERY")

if [ "$EXPAND_QUERY" = true ]; then
  echo -e "${BLUE}📝 ステップ1: クエリ拡張${NC}"
  
  # 単語分割
  IFS=' ' read -ra WORDS <<< "$ORIGINAL_QUERY"
  
  # バリエーション生成
  if [[ "$ORIGINAL_QUERY" == *"決定"* ]]; then
    EXPANDED_QUERIES+=("ユーザーの判断" "最終決定" "選択肢" "決意")
  fi
  
  if [[ "$ORIGINAL_QUERY" == *"プロジェクト"* ]]; then
    EXPANDED_QUERIES+=("タスク" "プロジェクト管理" "進行中の仕事" "作業")
  fi
  
  if [[ "$ORIGINAL_QUERY" == *"設定"* ]]; then
    EXPANDED_QUERIES+=("設定変更" "コンフィグ" "パラメータ" "カスタマイズ")
  fi
  
  echo -e "  元のクエリ: ${YELLOW}${ORIGINAL_QUERY}${NC}"
  for i in "${!EXPANDED_QUERIES[@]}"; do
    if [ "$i" -gt 0 ]; then
      echo -e "  拡張クエリ$i: ${YELLOW}${EXPANDED_QUERIES[$i]}${NC}"
    fi
  done
  echo ""
fi

# ================================================================================
# ステップ2: セマンティック検索実行
# ================================================================================

echo -e "${BLUE}🔎 ステップ2: セマンティック検索実行${NC}"

# 記憶検索結果を格納する配列
declare -a SEMANTIC_RESULTS=()

# プライマリ検索
echo -e "  🔹 プライマリ検索: ${YELLOW}${ORIGINAL_QUERY}${NC}"
PRIMARY_RESULT=$(clawdbot memory recall "$ORIGINAL_QUERY" 2>/dev/null || echo "")

if [[ -n "$PRIMARY_RESULT" ]]; then
  SEMANTIC_RESULTS+=("$PRIMARY_RESULT")
  echo -e "    ${GREEN}✓ 結果取得${NC}"
else
  echo -e "    ${YELLOW}⚠ 結果なし${NC}"
fi

# 拡張クエリ検索（ハイブリッドモード）
if [ "$HYBRID_MODE" = true ] && [ "$EXPAND_QUERY" = true ]; then
  echo ""
  for i in "${!EXPANDED_QUERIES[@]}"; do
    if [ "$i" -gt 0 ]; then
      EXPANDED_QUERY="${EXPANDED_QUERIES[$i]}"
      echo -e "  🔹 拡張検索$i: ${YELLOW}${EXPANDED_QUERY}${NC}"
      EXPANDED_RESULT=$(clawdbot memory recall "$EXPANDED_QUERY" 2>/dev/null || echo "")
      if [[ -n "$EXPANDED_RESULT" ]]; then
        SEMANTIC_RESULTS+=("$EXPANDED_RESULT")
        echo -e "    ${GREEN}✓ 結果取得${NC}"
      else
        echo -e "    ${YELLOW}⚠ 結果なし${NC}"
      fi
    fi
  done
fi

echo ""

# ================================================================================
# ステップ3: キーワードフィルタリング（ハイブリッド検索）
# ================================================================================

if [ "$HYBRID_MODE" = true ]; then
  echo -e "${BLUE}🏷️  ステップ3: キーワードフィルタリング${NC}"
  echo -e "  元のクエリから重要キーワードを抽出:"
  
  # 単語分割して重要度を判定
  IFS=' ' read -ra KEYWORDS <<< "$ORIGINAL_QUERY"
  IMPORTANT_KEYWORDS=()
  
  for keyword in "${KEYWORDS[@]}"; do
    # 3文字以上かつ記号でない場合は重要キーワード
    if [[ ${#keyword} -ge 3 && ! "$keyword" =~ ^[[:punct:]] ]]; then
      IMPORTANT_KEYWORDS+=("$keyword")
      echo -e "    🔑 ${YELLOW}${keyword}${NC}"
    fi
  done
  echo ""
fi

# ================================================================================
# ステップ4: リランキング
# ================================================================================

if [ "$RERANK_RESULTS" = true ] && [ ${#SEMANTIC_RESULTS[@]} -gt 0 ]; then
  echo -e "${BLUE}⭐ ステップ4: 関連度スコアによるリランキング${NC}"
  
  # 簡易的なスコアリング（実装例）
  declare -a SCORED_RESULTS
  
  for i in "${!SEMANTIC_RESULTS[@]}"; do
    RESULT="${SEMANTIC_RESULTS[$i]}"
    SCORE=100
    
    # キーワードマッチスコア加算
    for keyword in "${IMPORTANT_KEYWORDS[@]:-}"; do
      if [[ "$RESULT" == *"$keyword"* ]]; then
        SCORE=$((SCORE + 20))
      fi
    done
    
    # 長さスコア（関連情報が多い）
    RESULT_LENGTH=${#RESULT}
    if [[ $RESULT_LENGTH -gt 500 ]]; then
      SCORE=$((SCORE + 10))
    fi
    
    SCORED_RESULTS+=("${SCORE}|${RESULT}")
  done
  
  # スコアでソート（降順）
  IFS=$'\n' SORTED=($(sort -t'|' -k1 -rn <<<"${SCORED_RESULTS[*]}" || true))
  
  echo "  関連度スコアでリランキング完了:"
  for i in "${!SORTED[@]}"; do
    SCORE_AND_RESULT="${SORTED[$i]}"
    SCORE="${SCORE_AND_RESULT%%|*}"
    RESULT="${SCORE_AND_RESULT#*|}"
    echo -e "  ${i+$((i+1))}. スコア: ${YELLOW}${SCORE}${NC} - ${RESULT:0:80}..."
  done
  echo ""
fi

# ================================================================================
# 最終結果出力
# ================================================================================

echo -e "${BLUE}📊 最終結果${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ${#SEMANTIC_RESULTS[@]} -eq 0 ]; then
  echo -e "${YELLOW}⚠ 検索結果がありません${NC}"
  echo -e "💡 ヒント: より一般的な用語で検索してみてください"
else
  echo -e "${GREEN}✓ ${#SEMANTIC_RESULTS[@]} 件の結果を取得しました${NC}"
  echo ""
  
  if [ "$RERANK_RESULTS" = true ]; then
    echo -e "${BLUE}リランキング済み結果（スコア順）:${NC}"
    for i in "${!SORTED[@]:-}"; do
      if [ ${#SORTED[@]:-0} -gt 0 ]; then
        SCORE_AND_RESULT="${SORTED[$i]}"
        SCORE="${SCORE_AND_RESULT%%|*}"
        RESULT="${SCORE_AND_RESULT#*|}"
        echo -e "${i+$((i+1))}. [スコア: ${YELLOW}${SCORE}${NC}]"
        echo "   ${RESULT:0:150}..."
        echo ""
      fi
    done
  else
    for i in "${!SEMANTIC_RESULTS[@]}"; do
      RESULT="${SEMANTIC_RESULTS[$i]}"
      echo -e "$((i+1)). ${RESULT:0:150}..."
      echo ""
    done
  fi
fi

# ================================================================================
# 統計情報
# ================================================================================

echo -e "${BLUE}📈 実行統計${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  元のクエリ: ${YELLOW}${ORIGINAL_QUERY}${NC}"
echo -e "  検索バリエーション: ${YELLOW}${#EXPANDED_QUERIES[@]}${NC}"
echo -e "  結果数: ${YELLOW}${#SEMANTIC_RESULTS[@]}${NC}"
echo -e "  ハイブリッドモード: $([ "$HYBRID_MODE" = true ] && echo -e "${GREEN}有効${NC}" || echo -e "${YELLOW}無効${NC}")"
echo -e "  リランキング: $([ "$RERANK_RESULTS" = true ] && echo -e "${GREEN}有効${NC}" || echo -e "${YELLOW}無効${NC}")"
echo ""

echo -e "${GREEN}✅ 検索完了${NC}"
