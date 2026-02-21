#!/usr/bin/env python3
"""
エンゲージメント追跡スケジューラー
投稿から24時間後、48時間後、7日後に自動取得
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

# 仮想環境のPythonを使用
VENV_PYTHON = Path('/root/clawd/skills/sns-growth-tracker/venv/bin/python3')
SCRIPT_DIR = Path('/root/clawd/skills/sns-growth-tracker/scripts')
DATA_DIR = Path('/root/clawd/skills/sns-growth-tracker/data')

class EngagementScheduler:
    def __init__(self):
        self.schedule_file = DATA_DIR / 'engagement_schedule.json'
        self.schedule_file.parent.mkdir(parents=True, exist_ok=True)
        self.schedules = self._load_schedules()
    
    def _load_schedules(self):
        """スケジュールを読み込み"""
        if self.schedule_file.exists():
            try:
                with open(self.schedule_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ スケジュール読み込みエラー: {e}")
        return {'posts': []}
    
    def _save_schedules(self):
        """スケジュールを保存"""
        try:
            with open(self.schedule_file, 'w', encoding='utf-8') as f:
                json.dump(self.schedules, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"❌ スケジュール保存エラー: {e}")
    
    def add_post(self, post_id: str, platform: str, post_url: str, post_time: str = None):
        """
        投稿をスケジュールに追加
        
        Args:
            post_id: 投稿ID
            platform: プラットフォーム名
            post_url: 投稿URL
            post_time: 投稿日時（ISO形式、デフォルトは現在時刻）
        """
        if not post_time:
            post_time = datetime.now().isoformat()
        
        post_dt = datetime.fromisoformat(post_time)
        
        # 取得スケジュール（24時間、48時間、7日後）
        tracking_points = [
            {
                'hours_after': 24,
                'scheduled_time': (post_dt + timedelta(hours=24)).isoformat(),
                'completed': False
            },
            {
                'hours_after': 48,
                'scheduled_time': (post_dt + timedelta(hours=48)).isoformat(),
                'completed': False
            },
            {
                'hours_after': 168,  # 7日
                'scheduled_time': (post_dt + timedelta(hours=168)).isoformat(),
                'completed': False
            }
        ]
        
        post_schedule = {
            'post_id': post_id,
            'platform': platform,
            'post_url': post_url,
            'post_time': post_time,
            'tracking_points': tracking_points,
            'added_at': datetime.now().isoformat()
        }
        
        self.schedules['posts'].append(post_schedule)
        self._save_schedules()
        
        print(f"✅ スケジュール追加: {post_id} ({platform})")
        for point in tracking_points:
            print(f"  - {point['hours_after']}時間後: {point['scheduled_time']}")
    
    async def check_and_run(self):
        """スケジュールをチェックして実行"""
        now = datetime.now()
        executed_count = 0
        
        for post in self.schedules['posts']:
            for point in post['tracking_points']:
                if point['completed']:
                    continue
                
                scheduled_time = datetime.fromisoformat(point['scheduled_time'])
                
                # 実行時刻を過ぎている場合
                if now >= scheduled_time:
                    print(f"\n📊 エンゲージメント取得開始:")
                    print(f"  投稿ID: {post['post_id']}")
                    print(f"  プラットフォーム: {post['platform']}")
                    print(f"  経過時間: {point['hours_after']}時間")
                    
                    success = await self._fetch_engagement(
                        post['platform'],
                        post['post_url'],
                        post['post_id'],
                        point['hours_after']
                    )
                    
                    if success:
                        point['completed'] = True
                        point['completed_at'] = now.isoformat()
                        executed_count += 1
                    else:
                        # 失敗時は30分後に再試行
                        point['scheduled_time'] = (now + timedelta(minutes=30)).isoformat()
                        print(f"⚠️ 取得失敗、30分後に再試行")
        
        self._save_schedules()
        
        if executed_count > 0:
            print(f"\n✅ {executed_count}件のエンゲージメントデータを取得しました")
        else:
            print("\n⏰ 実行待ちのスケジュールはありません")
    
    async def _fetch_engagement(self, platform: str, post_url: str, post_id: str, hours_after: int) -> bool:
        """エンゲージメントを取得してSheetsに記録"""
        try:
            # エンゲージメント取得
            get_engagement_script = SCRIPT_DIR / 'get-engagement.py'
            
            proc = await asyncio.create_subprocess_exec(
                str(VENV_PYTHON),
                str(get_engagement_script),
                platform,
                post_url,
                '--headless',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                print(f"❌ エンゲージメント取得エラー:")
                print(stderr.decode())
                return False
            
            # エンゲージメントデータを読み込み
            engagement_file = Path('/tmp/engagement_data.json')
            if not engagement_file.exists():
                print(f"❌ エンゲージメントデータが見つかりません")
                return False
            
            with open(engagement_file, 'r', encoding='utf-8') as f:
                engagement_data = json.load(f)
            
            # メタデータを追加
            engagement_data['post_id'] = post_id
            engagement_data['hours_after_post'] = hours_after
            
            # Google Sheetsに記録
            record_script = SCRIPT_DIR / 'record-to-sheets.py'
            
            # 一時ファイルに保存
            temp_data = Path('/tmp/engagement_to_record.json')
            with open(temp_data, 'w', encoding='utf-8') as f:
                json.dump({
                    'post_id': post_id,
                    'platform': platform,
                    'engagement': engagement_data
                }, f, ensure_ascii=False, indent=2)
            
            proc = await asyncio.create_subprocess_exec(
                str(VENV_PYTHON),
                str(record_script),
                'engagement',
                str(temp_data),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                print(f"❌ Sheets記録エラー:")
                print(stderr.decode())
                return False
            
            result = json.loads(stdout.decode())
            
            if result.get('success'):
                print(f"✅ Google Sheetsに記録完了")
                return True
            else:
                print(f"❌ Sheets記録失敗: {result.get('error')}")
                return False
        
        except Exception as e:
            print(f"❌ エラー: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def list_schedules(self):
        """スケジュール一覧を表示"""
        print("\n📅 エンゲージメント追跡スケジュール:\n")
        
        if not self.schedules['posts']:
            print("スケジュールはありません")
            return
        
        now = datetime.now()
        
        for post in self.schedules['posts']:
            print(f"投稿ID: {post['post_id']}")
            print(f"プラットフォーム: {post['platform']}")
            print(f"投稿日時: {post['post_time']}")
            print(f"URL: {post['post_url']}")
            print(f"追跡ポイント:")
            
            for point in post['tracking_points']:
                status = "✅ 完了" if point['completed'] else "⏰ 待機中"
                scheduled_time = datetime.fromisoformat(point['scheduled_time'])
                time_diff = scheduled_time - now
                
                if point['completed']:
                    print(f"  - {point['hours_after']}時間後: {status} ({point.get('completed_at', 'N/A')})")
                else:
                    hours_left = time_diff.total_seconds() / 3600
                    if hours_left > 0:
                        print(f"  - {point['hours_after']}時間後: {status} (あと{hours_left:.1f}時間)")
                    else:
                        print(f"  - {point['hours_after']}時間後: 🔴 実行予定時刻を過ぎています")
            
            print()

def main():
    """メイン関数"""
    scheduler = EngagementScheduler()
    
    if len(sys.argv) < 2:
        print("使い方:")
        print("  python schedule-engagement-tracking.py add <post_id> <platform> <post_url> [post_time]")
        print("  python schedule-engagement-tracking.py check")
        print("  python schedule-engagement-tracking.py list")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'add':
        if len(sys.argv) < 5:
            print("❌ 引数が不足しています")
            print("使い方: python schedule-engagement-tracking.py add <post_id> <platform> <post_url> [post_time]")
            sys.exit(1)
        
        post_id = sys.argv[2]
        platform = sys.argv[3]
        post_url = sys.argv[4]
        post_time = sys.argv[5] if len(sys.argv) > 5 else None
        
        scheduler.add_post(post_id, platform, post_url, post_time)
    
    elif command == 'check':
        asyncio.run(scheduler.check_and_run())
    
    elif command == 'list':
        scheduler.list_schedules()
    
    else:
        print(f"❌ 不明なコマンド: {command}")
        sys.exit(1)

if __name__ == '__main__':
    main()
