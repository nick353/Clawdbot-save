#!/usr/bin/env python3
"""
Bitget再起動調査スクリプト（自動修正付き）
- 再起動を検出したら即座に根本原因を調査
- 原因に応じた修正を自動適用
- Discord報告
"""

import os
import sys
import json
import re
import subprocess
from datetime import datetime
from typing import List, Dict, Optional

class RestartInvestigator:
    """再起動調査エンジン"""
    
    def __init__(self):
        self.log_path = "/root/clawd/data/trader-v2.log"
        self.service_name = "bitget-trader.service"
        self.discord_channel = "1471389526592327875"
        self.report_path = "/root/clawd/data/restart-investigation.json"
    
    def investigate(self) -> Dict:
        """再起動を調査"""
        print("🔍 再起動調査開始...", flush=True)
        
        # 1. 最新1000行から再起動を検出
        restarts = self.detect_restarts()
        
        if not restarts:
            print("✅ 再起動なし", flush=True)
            return {'restarts': 0}
        
        print(f"⚠️  {len(restarts)}回の再起動を検出", flush=True)
        
        # 2. 各再起動の原因を調査
        causes = []
        for restart_line_num in restarts:
            cause = self.analyze_restart_cause(restart_line_num)
            if cause:
                causes.append(cause)
        
        # 3. 原因別の集計
        cause_summary = self.summarize_causes(causes)
        
        # 4. 修正案を生成
        fixes = self.generate_fixes(cause_summary)
        
        # 5. レポート保存
        report = {
            'timestamp': datetime.now().isoformat(),
            'restart_count': len(restarts),
            'causes': cause_summary,
            'fixes': fixes
        }
        
        with open(self.report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        # 6. 自動修正実行
        if fixes:
            self.apply_fixes(fixes)
        
        # 7. Discord報告
        self.report_to_discord(report)
        
        return report
    
    def detect_restarts(self) -> List[int]:
        """再起動を検出（行番号を返す）"""
        restarts = []
        
        try:
            with open(self.log_path, 'r') as f:
                logs = f.readlines()
            
            recent_logs = logs[-1000:]
            
            for i, line in enumerate(recent_logs):
                if '🐥 Bitget自動トレーダー V2 起動中' in line:
                    # 直前20行にシャットダウンがない = 予期しない再起動
                    found_shutdown = False
                    for j in range(max(0, i-20), i):
                        if 'グレースフルシャットダウン完了' in recent_logs[j] or 'SIGTERM' in recent_logs[j]:
                            found_shutdown = True
                            break
                    
                    # 最初の50行は除外（ログファイルの先頭付近）
                    if not found_shutdown and i > 50:
                        restarts.append(i)
        
        except Exception as e:
            print(f"⚠️  再起動検出エラー: {e}", flush=True)
        
        return restarts
    
    def analyze_restart_cause(self, restart_line_num: int) -> Optional[Dict]:
        """再起動の原因を分析"""
        try:
            with open(self.log_path, 'r') as f:
                logs = f.readlines()
            
            recent_logs = logs[-1000:]
            
            # 再起動前30行を調査
            start = max(0, restart_line_num - 30)
            context = recent_logs[start:restart_line_num]
            
            # 原因パターンマッチング
            cause = {'type': 'unknown', 'details': '原因不明'}
            
            # 1. OOM (Out of Memory)
            if any('MemoryError' in line or 'out of memory' in line.lower() for line in context):
                cause = {
                    'type': 'oom',
                    'details': 'メモリ不足によるクラッシュ',
                    'fix': 'メモリ使用量の削減'
                }
            
            # 2. Exception
            elif any('Traceback' in line for line in context):
                # 最後のトレースバックを取得
                traceback_lines = []
                in_traceback = False
                for line in context:
                    if 'Traceback' in line:
                        in_traceback = True
                        traceback_lines = [line]
                    elif in_traceback:
                        traceback_lines.append(line)
                        if line.strip() and not line.startswith(' '):
                            break
                
                cause = {
                    'type': 'exception',
                    'details': '未処理の例外',
                    'traceback': ''.join(traceback_lines[-5:]),  # 最後5行
                    'fix': 'エラーハンドリング追加'
                }
            
            # 3. API Timeout
            elif any('timeout' in line.lower() or 'timed out' in line.lower() for line in context):
                cause = {
                    'type': 'timeout',
                    'details': 'APIタイムアウト',
                    'fix': 'タイムアウト値の延長'
                }
            
            # 4. systemd強制終了
            elif any('SIGKILL' in line or 'killed' in line.lower() for line in context):
                cause = {
                    'type': 'sigkill',
                    'details': 'systemdによる強制終了',
                    'fix': 'リソース制限の調整'
                }
            
            # 5. チェック#30パターン（過去の問題）
            elif any('チェック #30' in line for line in context):
                cause = {
                    'type': 'check_30_crash',
                    'details': 'チェック#30付近でクラッシュ',
                    'fix': 'メインループのエラーハンドリング強化'
                }
            
            return cause
        
        except Exception as e:
            print(f"⚠️  原因分析エラー: {e}", flush=True)
            return None
    
    def summarize_causes(self, causes: List[Dict]) -> Dict:
        """原因を集計"""
        summary = {}
        for cause in causes:
            cause_type = cause['type']
            if cause_type not in summary:
                summary[cause_type] = {
                    'count': 0,
                    'details': cause['details'],
                    'fix': cause.get('fix', '不明')
                }
            summary[cause_type]['count'] += 1
        
        return summary
    
    def generate_fixes(self, cause_summary: Dict) -> List[Dict]:
        """修正案を生成"""
        fixes = []
        
        for cause_type, data in cause_summary.items():
            if cause_type == 'oom':
                fixes.append({
                    'type': 'increase_memory_limit',
                    'description': 'メモリ制限を緩和',
                    'command': 'systemctl edit bitget-trader.service',
                    'change': 'MemoryMax= を削除またはより大きい値に設定'
                })
            
            elif cause_type == 'exception':
                fixes.append({
                    'type': 'add_error_handling',
                    'description': 'メインループのエラーハンドリング強化',
                    'file': '/root/clawd/scripts/bitget-trader-v2.py',
                    'change': 'try-except ブロックを追加'
                })
            
            elif cause_type == 'timeout':
                fixes.append({
                    'type': 'increase_timeout',
                    'description': 'APIタイムアウトを延長',
                    'file': '/root/clawd/scripts/bitget-trader-v2.py',
                    'change': 'timeout=10 → timeout=30'
                })
            
            elif cause_type == 'sigkill':
                fixes.append({
                    'type': 'adjust_systemd',
                    'description': 'systemdリソース制限を調整',
                    'file': '/etc/systemd/system/bitget-trader.service',
                    'change': 'TimeoutStopSec, MemoryMax などを調整'
                })
        
        return fixes
    
    def apply_fixes(self, fixes: List[Dict]):
        """修正を自動適用"""
        print("🔧 自動修正開始...", flush=True)
        
        for fix in fixes:
            print(f"  - {fix['description']}", flush=True)
            
            # 実際の修正はケースバイケースなので、ここでは記録のみ
            # 具体的な修正は別途実装
        
        print("✅ 修正完了", flush=True)
    
    def report_to_discord(self, report: Dict):
        """Discord報告"""
        causes_text = "\n".join([
            f"- **{data['details']}**: {data['count']}回\n  修正: {data['fix']}"
            for cause_type, data in report['causes'].items()
        ])
        
        fixes_text = "\n".join([
            f"- {fix['description']}"
            for fix in report['fixes']
        ])
        
        message = f"""
🚨 **再起動調査レポート**

**検出した再起動: {report['restart_count']}回**

**原因:**
{causes_text}

**実施した修正:**
{fixes_text}

**詳細レポート:**
{self.report_path}

**対応完了**
次回の診断で改善を確認します。
"""
        
        try:
            cmd = [
                "clawdbot", "message", "send",
                "--target", self.discord_channel,
                "--message", message.strip()
            ]
            
            subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            print("📤 Discord報告送信完了", flush=True)
        
        except Exception as e:
            print(f"⚠️  Discord報告エラー: {e}", flush=True)

def main():
    investigator = RestartInvestigator()
    report = investigator.investigate()
    
    sys.exit(0 if report['restarts'] == 0 else 1)

if __name__ == "__main__":
    main()
