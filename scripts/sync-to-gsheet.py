#!/usr/bin/env python3
"""
ポジションクローズ時にGoogle Sheetsを自動更新
（bitget-trader-v3.pyから呼ばれる）
"""

import subprocess
import sys

def main():
    """全シート更新を実行"""
    try:
        print("📊 Google Sheets同期開始...", flush=True)
        
        # update-all-sheets.shを実行
        result = subprocess.run(
            ["bash", "/root/clawd/scripts/update-all-sheets.sh"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            print("✅ Google Sheets同期完了", flush=True)
            return 0
        else:
            print(f"⚠️ Google Sheets同期エラー: {result.stderr}", flush=True)
            return 1
            
    except subprocess.TimeoutExpired:
        print("⚠️ Google Sheets同期タイムアウト（120秒）", flush=True)
        return 1
    except Exception as e:
        print(f"❌ Google Sheets同期エラー: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
