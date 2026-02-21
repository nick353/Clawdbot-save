#!/bin/bash
# トレーダーを停止させているプロセス/シグナルを追跡

PID=$(pgrep -f "python.*bitget-trader-v2.py" | head -1)

if [ -z "$PID" ]; then
    echo "トレーダープロセスが見つかりません"
    exit 1
fi

echo "=== トレーダープロセス追跡開始 ==="
echo "PID: $PID"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# プロセス情報
echo "=== プロセス情報 ==="
ps -f -p $PID
echo ""

# 親プロセス
PPID=$(ps -o ppid= -p $PID | tr -d ' ')
echo "親プロセス (PPID: $PPID):"
ps -f -p $PPID 2>/dev/null || echo "  親プロセス情報取得不可"
echo ""

# ファイルディスクリプタ
echo "=== ファイルディスクリプタ数 ==="
ls /proc/$PID/fd/ 2>/dev/null | wc -l
echo ""

# リソース制限
echo "=== リソース制限 ==="
cat /proc/$PID/limits 2>/dev/null | grep -E "Max cpu time|Max processes"
echo ""

# 環境変数でタイムアウト設定がないか
echo "=== 環境変数（TIMEOUT関連） ==="
cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | grep -i timeout || echo "なし"
echo ""

# auditdログ確認（シグナル送信の記録）
echo "=== audit ログ（あれば） ==="
ausearch -p $PID 2>/dev/null | tail -20 || echo "auditdなし"
echo ""

# systemd-cgtopでCPU/メモリ監視（あれば）
echo "=== Cgroup情報 ==="
cat /proc/$PID/cgroup 2>/dev/null || echo "cgroup情報なし"
echo ""

echo "=== 追跡完了 ==="
echo "30分後（チェック#30）の動作を監視してください"
echo ""
echo "リアルタイム監視コマンド:"
echo "  watch -n 5 'ps -f -p $PID 2>/dev/null || echo プロセス停止'"
