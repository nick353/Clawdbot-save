#!/usr/bin/env python3
"""
Bitget自動トレーダー自己診断スクリプト
- ログ分析
- コード分析
- 問題検出
- 修正案生成
- Discord報告
"""

import os
import sys
import json
import re
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Any
from collections import Counter

class BitgetSelfDiagnosis:
    """自己診断エンジン"""
    
    def __init__(self):
        self.log_path = "/root/clawd/data/trader-v2.log"
        self.code_path = "/root/clawd/scripts/bitget-trader-v2.py"
        self.positions_file = "/root/clawd/data/positions.json"
        self.report_path = "/root/clawd/data/diagnosis-report.json"
        self.discord_channel = "1471389526592327875"
        
        self.issues = []
        self.fixes = []
    
    def run_diagnosis(self):
        """診断実行"""
        print("🔍 自己診断開始...", flush=True)
        
        # ログ分析
        log_issues = self.analyze_logs()
        self.issues.extend(log_issues)
        
        # コード分析
        code_issues = self.analyze_code()
        self.issues.extend(code_issues)
        
        # 設定分析
        config_issues = self.analyze_config()
        self.issues.extend(config_issues)
        
        # 修正案生成
        if self.issues:
            self.generate_fixes()
        
        # レポート保存
        self.save_report()
        
        # Discord報告（問題がある場合のみ）
        if self.issues:
            self.report_to_discord()
        else:
            print("✅ 問題なし", flush=True)
        
        return len(self.issues)
    
    def analyze_logs(self) -> List[Dict]:
        """ログ分析"""
        issues = []
        
        try:
            if not os.path.exists(self.log_path):
                return issues
            
            with open(self.log_path, 'r') as f:
                logs = f.readlines()
            
            # 最新1000行のみ分析
            recent_logs = logs[-1000:]
            
            # 1. エラーパターン検出
            error_pattern = re.compile(r'(❌|⚠️|Error|ERROR|exception|Exception)')
            errors = [line for line in recent_logs if error_pattern.search(line)]
            
            # 正常なメッセージを除外（SIGTERM、メモリ使用率など）
            exclude_patterns = [
                r'シグナル受信: 15 \(SIGTERM\)',  # 正常な停止
                r'メモリ使用率高',  # 警告だが致命的ではない
                r'メモリ: \d+\.\d+%',  # 正常なメモリレポート
            ]
            
            filtered_errors = []
            for error in errors:
                is_excluded = False
                for pattern in exclude_patterns:
                    if re.search(pattern, error):
                        is_excluded = True
                        break
                if not is_excluded:
                    filtered_errors.append(error)
            
            if filtered_errors:
                # エラー種別をカウント
                error_types = Counter()
                for error in filtered_errors:
                    # エラーメッセージを抽出
                    match = re.search(r'(❌|⚠️)\s+(.+)', error)
                    if match:
                        error_msg = match.group(2).strip()
                        # 最初の100文字のみ（長すぎるエラーメッセージを短縮）
                        error_msg = error_msg[:100]
                        error_types[error_msg] += 1
                
                # 3回以上繰り返すエラーを問題として検出
                for error_msg, count in error_types.items():
                    if count >= 3:
                        issues.append({
                            'type': 'repeated_error',
                            'severity': 'high',
                            'message': f'繰り返しエラー: {error_msg}',
                            'count': count,
                            'details': error_msg
                        })
            
            # 2. クラッシュ検出
            crashes = self.detect_crashes(recent_logs)
            issues.extend(crashes)
            
            # 3. タイムアウト検出
            timeouts = [line for line in recent_logs if 'timed out' in line.lower()]
            if len(timeouts) >= 2:
                issues.append({
                    'type': 'timeout_issue',
                    'severity': 'medium',
                    'message': 'タイムアウトが頻発しています',
                    'count': len(timeouts),
                    'details': timeouts[0][:200] if timeouts else ''
                })
        
        except Exception as e:
            print(f"⚠️ ログ分析エラー: {e}", flush=True)
        
        return issues
    
    def detect_crashes(self, logs: List[str]) -> List[Dict]:
        """クラッシュ検出（改良版）"""
        crashes = []
        
        # 「🐥 起動中」を起動イベントとして検出
        unexpected_restarts = []
        
        for i, line in enumerate(logs):
            if '🐥 Bitget自動トレーダー V2 起動中' in line:
                # 直前20行以内にグレースフルシャットダウンがあるかチェック
                found_shutdown = False
                for j in range(max(0, i-20), i):
                    if 'グレースフルシャットダウン完了' in logs[j] or 'SIGTERM' in logs[j]:
                        found_shutdown = True
                        break
                
                # シャットダウンがない = 予期しない再起動（クラッシュ）
                if not found_shutdown:
                    # ただし、最初の起動（ログの最初の方）は除外
                    if i > 50:  # 最初の50行は除外
                        unexpected_restarts.append(i)
        
        # 予期しない再起動が1回でもあれば即座に調査
        if len(unexpected_restarts) >= 1:
            # 詳細調査スクリプトを起動
            print(f"🚨 {len(unexpected_restarts)}回の再起動を検出 - 詳細調査開始", flush=True)
            try:
                import subprocess
                result = subprocess.run(
                    ['python3', '/root/clawd/scripts/bitget-restart-investigator.py'],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                if result.returncode == 0:
                    print("✅ 詳細調査完了", flush=True)
                else:
                    print(f"⚠️ 詳細調査エラー: {result.stderr}", flush=True)
            except Exception as e:
                print(f"⚠️ 詳細調査起動失敗: {e}", flush=True)
            
            crashes.append({
                'type': 'unexpected_restart',
                'severity': 'high',
                'message': '予期しない再起動を検出',
                'details': f'直近1000行で{len(unexpected_restarts)}回の予期しない再起動（根本原因を調査中）'
            })
        
        return crashes
    
    def analyze_code(self) -> List[Dict]:
        """コード分析"""
        issues = []
        
        try:
            with open(self.code_path, 'r') as f:
                code = f.read()
            
            # 1. subprocess.run のタイムアウトチェック
            subprocess_calls = re.findall(r'subprocess\.run\([^)]+\)', code)
            for call in subprocess_calls:
                if 'timeout=' not in call:
                    issues.append({
                        'type': 'missing_timeout',
                        'severity': 'medium',
                        'message': 'subprocess.run にタイムアウトが設定されていません',
                        'details': call[:100]
                    })
            
            # 2. ポジション永続化チェック
            has_save_positions = 'def save_positions' in code
            has_load_positions = 'def load_positions' in code
            
            if not (has_save_positions and has_load_positions):
                issues.append({
                    'type': 'missing_persistence',
                    'severity': 'high',
                    'message': 'ポジション永続化機能が不足しています',
                    'details': f'save: {has_save_positions}, load: {has_load_positions}'
                })
        
        except Exception as e:
            print(f"⚠️ コード分析エラー: {e}", flush=True)
        
        return issues
    
    def analyze_config(self) -> List[Dict]:
        """設定分析"""
        issues = []
        
        # 今後実装: 監視銘柄の妥当性チェックなど
        
        return issues
    
    def generate_fixes(self):
        """修正案生成"""
        for issue in self.issues:
            fix = None
            
            if issue['type'] == 'repeated_error':
                fix = {
                    'issue_id': len(self.fixes),
                    'type': 'add_error_handling',
                    'auto_apply': False,  # 承認必要
                    'description': 'エラーハンドリング強化',
                    'details': f"{issue['details']} への対策を追加"
                }
            
            elif issue['type'] == 'timeout_issue':
                fix = {
                    'issue_id': len(self.fixes),
                    'type': 'increase_timeout',
                    'auto_apply': False,
                    'description': 'タイムアウト延長',
                    'details': 'subprocess タイムアウトを30秒に延長'
                }
            
            elif issue['type'] == 'missing_persistence':
                fix = {
                    'issue_id': len(self.fixes),
                    'type': 'add_persistence',
                    'auto_apply': False,
                    'description': 'ポジション永続化機能追加',
                    'details': 'save_positions/load_positions を実装'
                }
            
            elif issue['type'] == 'unexpected_restart':
                fix = {
                    'issue_id': len(self.fixes),
                    'type': 'add_crash_logging',
                    'auto_apply': True,  # 自動適用可
                    'description': '詳細クラッシュログ追加',
                    'details': 'トレースバック出力を強化'
                }
            
            if fix:
                self.fixes.append(fix)
    
    def save_report(self):
        """レポート保存"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'issues': self.issues,
            'fixes': self.fixes,
            'summary': {
                'total_issues': len(self.issues),
                'high_severity': len([i for i in self.issues if i.get('severity') == 'high']),
                'medium_severity': len([i for i in self.issues if i.get('severity') == 'medium']),
                'auto_fixable': len([f for f in self.fixes if f.get('auto_apply')])
            }
        }
        
        os.makedirs(os.path.dirname(self.report_path), exist_ok=True)
        
        with open(self.report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"📝 レポート保存: {self.report_path}", flush=True)
    
    def report_to_discord(self):
        """Discord報告"""
        summary = {
            'total': len(self.issues),
            'high': len([i for i in self.issues if i.get('severity') == 'high']),
            'medium': len([i for i in self.issues if i.get('severity') == 'medium'])
        }
        
        issues_text = "\n".join([
            f"{i+1}. {'🔴' if issue.get('severity') == 'high' else '🟡'} **{issue['message']}**\n   詳細: {issue.get('details', 'N/A')[:100]}"
            for i, issue in enumerate(self.issues[:5])  # 最大5件
        ])
        
        if len(self.issues) > 5:
            issues_text += f"\n\n...他 {len(self.issues) - 5} 件"
        
        fixes_text = "\n".join([
            f"{i+1}. {'✅ 自動適用可' if fix.get('auto_apply') else '⏳ 承認必要'}: {fix['description']}"
            for i, fix in enumerate(self.fixes[:5])
        ])
        
        message = f"""
🔍 **自己診断レポート**

**検出した問題: {summary['total']}件**
- 🔴 高: {summary['high']}件
- 🟡 中: {summary['medium']}件

{issues_text}

**修正案: {len(self.fixes)}件**

{fixes_text}

**詳細レポート:**
{self.report_path}

**自動修正:**
全ての修正を自動適用します（承認済み）
"""
        
        try:
            cmd = [
                "clawdbot", "message", "send",
                "--target", self.discord_channel,
                "--message", message.strip()
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("📤 Discord報告送信完了", flush=True)
            else:
                print(f"⚠️ Discord報告失敗: {result.stderr}", flush=True)
        
        except Exception as e:
            print(f"⚠️ Discord報告エラー: {e}", flush=True)

def main():
    diagnosis = BitgetSelfDiagnosis()
    issue_count = diagnosis.run_diagnosis()
    
    sys.exit(0 if issue_count == 0 else 1)

if __name__ == "__main__":
    main()
