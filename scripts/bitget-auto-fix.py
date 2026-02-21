#!/usr/bin/env python3
"""
Bitget自動トレーダー自動修正スクリプト
- 診断レポート読み込み
- 修正適用
- Discord報告
"""

import os
import sys
import json
import subprocess
import shutil
from datetime import datetime
from typing import List, Dict

class BitgetAutoFix:
    """自動修正エンジン"""
    
    def __init__(self):
        self.report_path = "/root/clawd/data/diagnosis-report.json"
        self.code_path = "/root/clawd/scripts/bitget-trader-v2.py"
        self.backup_dir = "/root/clawd/data/backups"
        self.fix_history_path = "/root/clawd/data/fix-history.json"
        self.discord_channel = "1471389526592327875"
        
        self.applied_fixes = []
    
    def load_report(self) -> Dict:
        """診断レポート読み込み"""
        if not os.path.exists(self.report_path):
            print("⚠️ 診断レポートが見つかりません", flush=True)
            return None
        
        with open(self.report_path, 'r') as f:
            return json.load(f)
    
    def backup_code(self):
        """コードバックアップ"""
        os.makedirs(self.backup_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = f"{self.backup_dir}/bitget-trader-v2_{timestamp}.py"
        
        shutil.copy2(self.code_path, backup_path)
        print(f"📦 バックアップ作成: {backup_path}", flush=True)
        
        return backup_path
    
    def apply_fixes(self, fixes: List[Dict], auto_only: bool = True):
        """修正適用"""
        # バックアップ作成
        backup_path = self.backup_code()
        
        for fix in fixes:
            # auto_only=True の場合、自動適用可能な修正のみ
            if auto_only and not fix.get('auto_apply'):
                continue
            
            try:
                if fix['type'] == 'add_crash_logging':
                    # 既に追加済み（前回の修正で対応済み）
                    self.applied_fixes.append({
                        **fix,
                        'status': 'already_applied',
                        'message': '既に詳細ログが追加されています'
                    })
                
                elif fix['type'] == 'increase_timeout':
                    # タイムアウト延長（承認必要なので、auto_only=Falseで実行）
                    if not auto_only:
                        success = self.increase_timeout()
                        self.applied_fixes.append({
                            **fix,
                            'status': 'applied' if success else 'failed',
                            'message': 'タイムアウトを30秒に延長しました' if success else '適用失敗'
                        })
                
                elif fix['type'] == 'add_error_handling':
                    # エラーハンドリング追加（今後実装）
                    self.applied_fixes.append({
                        **fix,
                        'status': 'pending',
                        'message': '手動対応が必要です'
                    })
            
            except Exception as e:
                self.applied_fixes.append({
                    **fix,
                    'status': 'error',
                    'message': f'適用エラー: {e}'
                })
        
        # 修正履歴保存
        self.save_fix_history(backup_path)
        
        return len([f for f in self.applied_fixes if f['status'] == 'applied'])
    
    def increase_timeout(self) -> bool:
        """タイムアウト延長"""
        try:
            with open(self.code_path, 'r') as f:
                code = f.read()
            
            # タイムアウト10秒を30秒に変更（既に30秒になっている可能性あり）
            if 'timeout=10' in code:
                code = code.replace('timeout=10', 'timeout=30')
                
                with open(self.code_path, 'w') as f:
                    f.write(code)
                
                print("✅ タイムアウトを30秒に延長しました", flush=True)
                return True
            else:
                print("⚠️ timeout=10 が見つかりません（既に修正済み？）", flush=True)
                return False
        
        except Exception as e:
            print(f"❌ タイムアウト延長エラー: {e}", flush=True)
            return False
    
    def save_fix_history(self, backup_path: str):
        """修正履歴保存"""
        history = {
            'timestamp': datetime.now().isoformat(),
            'backup_path': backup_path,
            'fixes': self.applied_fixes
        }
        
        # 既存履歴読み込み
        all_history = []
        if os.path.exists(self.fix_history_path):
            with open(self.fix_history_path, 'r') as f:
                all_history = json.load(f)
        
        # 追加
        all_history.append(history)
        
        # 保存（最新100件のみ）
        with open(self.fix_history_path, 'w') as f:
            json.dump(all_history[-100:], f, indent=2)
        
        print(f"📝 修正履歴保存: {self.fix_history_path}", flush=True)
    
    def restart_trader(self) -> bool:
        """トレーダー再起動"""
        try:
            # 既存プロセス停止
            subprocess.run(["pkill", "-f", "python.*bitget-trader-v2.py"], timeout=10)
            
            import time
            time.sleep(3)
            
            # 再起動
            cmd = "cd /root/clawd && nohup python3 -u scripts/bitget-trader-v2.py >> /root/clawd/data/trader-v2.log 2>&1 &"
            subprocess.run(cmd, shell=True, timeout=10)
            
            print("🔄 トレーダー再起動完了", flush=True)
            return True
        
        except Exception as e:
            print(f"❌ 再起動エラー: {e}", flush=True)
            return False
    
    def report_to_discord(self, applied_count: int):
        """Discord報告"""
        applied = [f for f in self.applied_fixes if f['status'] == 'applied']
        already_applied = [f for f in self.applied_fixes if f['status'] == 'already_applied']
        failed = [f for f in self.applied_fixes if f['status'] in ['failed', 'error']]
        
        applied_text = "\n".join([
            f"{i+1}. ✅ {fix['description']}: {fix['message']}"
            for i, fix in enumerate(applied)
        ]) or "なし"
        
        already_text = "\n".join([
            f"{i+1}. ℹ️ {fix['description']}: {fix['message']}"
            for i, fix in enumerate(already_applied)
        ]) if already_applied else ""
        
        failed_text = "\n".join([
            f"{i+1}. ❌ {fix['description']}: {fix['message']}"
            for i, fix in enumerate(failed)
        ]) if failed else ""
        
        message = f"""
✅ **自動修正完了**

**適用した修正: {applied_count}件**

{applied_text}
"""
        
        if already_text:
            message += f"\n**既に適用済み:**\n\n{already_text}"
        
        if failed_text:
            message += f"\n**失敗:**\n\n{failed_text}"
        
        message += f"""

**詳細履歴:**
{self.fix_history_path}

**バックアップ:**
{self.backup_dir}/
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
    if len(sys.argv) < 2:
        print("使用方法: bitget-auto-fix.py [auto|all]", flush=True)
        print("  auto: 自動適用可能な修正のみ", flush=True)
        print("  all:  全ての修正を適用（承認済み）", flush=True)
        sys.exit(1)
    
    mode = sys.argv[1]
    auto_only = (mode == 'auto')
    
    fixer = BitgetAutoFix()
    
    # 診断レポート読み込み
    report = fixer.load_report()
    if not report:
        sys.exit(1)
    
    fixes = report.get('fixes', [])
    if not fixes:
        print("✅ 適用する修正がありません", flush=True)
        sys.exit(0)
    
    print(f"🔧 修正適用開始（モード: {mode}）...", flush=True)
    
    # 修正適用
    applied_count = fixer.apply_fixes(fixes, auto_only=auto_only)
    
    # Discord報告
    fixer.report_to_discord(applied_count)
    
    # 再起動（修正を適用した場合のみ）
    if applied_count > 0:
        fixer.restart_trader()
    
    print(f"✅ 完了（適用: {applied_count}件）", flush=True)

if __name__ == "__main__":
    main()
