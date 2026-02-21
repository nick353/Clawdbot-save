#!/usr/bin/env python3
"""
サブエージェント委譲スクリプト
- 重い作業をサブエージェントに委譲
- メインセッションのトークン消費を削減
"""

import subprocess
import sys
from typing import Optional

class SubAgentDispatcher:
    """サブエージェント委譲エンジン"""
    
    HEAVY_TASKS = [
        "backtest",         # バックテスト
        "deep_analysis",    # 詳細分析
        "optimization",     # 最適化
        "research",         # リサーチ
    ]
    
    def should_delegate(self, task_type: str) -> bool:
        """委譲すべきタスクか判定"""
        return task_type in self.HEAVY_TASKS
    
    def spawn(self, task: str, timeout: int = 3600) -> Optional[str]:
        """
        サブエージェントを起動
        
        Args:
            task: タスク内容
            timeout: タイムアウト（秒）
        
        Returns:
            サブエージェントのセッションキー
        """
        try:
            cmd = [
                "clawdbot", "sessions", "spawn",
                "--task", task,
                "--timeout", str(timeout),
                "--cleanup", "delete"
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # セッションキーを抽出
                output = result.stdout
                for line in output.split('\n'):
                    if 'session' in line.lower():
                        return line.strip()
                return "spawned"
            else:
                print(f"⚠️ Spawn失敗: {result.stderr}", file=sys.stderr)
                return None
        
        except Exception as e:
            print(f"❌ Spawn エラー: {e}", file=sys.stderr)
            return None

def main():
    """CLI テスト"""
    dispatcher = SubAgentDispatcher()
    
    task = "Bitgetの過去1週間のトレードデータを分析して、最適なパラメータを提案してください"
    
    if dispatcher.should_delegate("deep_analysis"):
        print("🚀 サブエージェントに委譲します...")
        session_key = dispatcher.spawn(task)
        print(f"✅ セッション: {session_key}")
    else:
        print("⚠️ メインセッションで実行します")

if __name__ == "__main__":
    main()
