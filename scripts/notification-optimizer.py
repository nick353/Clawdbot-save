#!/usr/bin/env python3
"""
Discord通知最適化スクリプト
- 重要度に応じて通知の詳細度を調整
- 定期報告は要約形式
- 緊急時のみ詳細通知
"""

import sys
from typing import Dict, Optional

class NotificationOptimizer:
    """通知最適化エンジン"""
    
    PRIORITY_HIGH = "high"      # 即座に詳細通知
    PRIORITY_MEDIUM = "medium"  # 要約通知
    PRIORITY_LOW = "low"        # バッチ通知（1時間ごと）
    
    def __init__(self):
        self.pending_low = []
    
    def optimize(self, event_type: str, data: Dict) -> Optional[str]:
        """
        通知を最適化
        
        Args:
            event_type: イベント種別
            data: イベントデータ
        
        Returns:
            通知メッセージ（None = 通知不要）
        """
        priority = self.get_priority(event_type)
        
        if priority == self.PRIORITY_HIGH:
            return self.format_detailed(event_type, data)
        elif priority == self.PRIORITY_MEDIUM:
            return self.format_summary(event_type, data)
        else:
            # 低優先度はバッチ処理
            self.pending_low.append((event_type, data))
            return None
    
    def get_priority(self, event_type: str) -> str:
        """イベント種別から優先度を判定"""
        high_priority = [
            "entry",        # エントリー
            "exit",         # エグジット
            "error",        # エラー
            "crash",        # クラッシュ
            "stop_loss",    # ストップロス到達
        ]
        
        medium_priority = [
            "diagnosis",    # 自己診断
            "fix",          # 自動修正
            "restart",      # 再起動
        ]
        
        if event_type in high_priority:
            return self.PRIORITY_HIGH
        elif event_type in medium_priority:
            return self.PRIORITY_MEDIUM
        else:
            return self.PRIORITY_LOW
    
    def format_detailed(self, event_type: str, data: Dict) -> str:
        """詳細通知"""
        return data.get('message', str(data))
    
    def format_summary(self, event_type: str, data: Dict) -> str:
        """要約通知"""
        if event_type == "diagnosis":
            return f"🔍 診断: {data.get('issues', 0)}件検出 → {data.get('fixes', 0)}件修正"
        elif event_type == "fix":
            return f"✅ 修正: {data.get('applied', 0)}件適用"
        elif event_type == "restart":
            return f"🔄 再起動: PID {data.get('pid', '?')}"
        else:
            return str(data)
    
    def flush_pending(self) -> Optional[str]:
        """低優先度通知をバッチ送信"""
        if not self.pending_low:
            return None
        
        summary = f"📊 定期レポート: {len(self.pending_low)}件\n"
        summary += "\n".join([
            f"- {event}: {data.get('summary', str(data)[:50])}"
            for event, data in self.pending_low[:10]
        ])
        
        self.pending_low.clear()
        return summary

def main():
    """CLI テスト"""
    optimizer = NotificationOptimizer()
    
    # テスト
    events = [
        ("entry", {"message": "BTCUSDT エントリー"}),
        ("diagnosis", {"issues": 3, "fixes": 2}),
        ("heartbeat", {"status": "ok"}),
    ]
    
    for event_type, data in events:
        msg = optimizer.optimize(event_type, data)
        if msg:
            print(f"[{event_type}] {msg}")
    
    # バッチ送信
    batch = optimizer.flush_pending()
    if batch:
        print(f"\n[BATCH] {batch}")

if __name__ == "__main__":
    main()
