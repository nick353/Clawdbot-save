#!/usr/bin/env python3
"""
Discord投稿検知スクリプト
#sns-投稿チャンネルを監視して自動処理を実行
"""

import os
import sys
import json
import subprocess
import time
from pathlib import Path
from datetime import datetime
import requests

class DiscordPostWatcher:
    def __init__(self):
        self.skill_dir = Path(__file__).parent.parent
        self.data_dir = self.skill_dir / 'data'
        self.downloads_dir = self.data_dir / 'downloads'
        self.logs_dir = self.data_dir / 'logs'
        
        # ディレクトリ作成
        self.downloads_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        
        # 設定
        self.target_channel_id = '1470060780111007950'  # #sns-投稿
        self.target_user_id = '802126034631393320'  # andoさん
        self.processed_file = self.data_dir / 'processed_messages.json'
        
        # 処理済みメッセージIDを読み込み
        self.processed_messages = self._load_processed_messages()
    
    def _load_processed_messages(self):
        """処理済みメッセージIDを読み込み"""
        if self.processed_file.exists():
            with open(self.processed_file, 'r') as f:
                return set(json.load(f))
        return set()
    
    def _save_processed_messages(self):
        """処理済みメッセージIDを保存"""
        with open(self.processed_file, 'w') as f:
            json.dump(list(self.processed_messages), f)
    
    def _log(self, message, level='INFO'):
        """ログを記録"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        # ログファイルに書き込み
        log_file = self.logs_dir / f"watcher-{datetime.now().strftime('%Y%m%d')}.log"
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + '\n')
    
    def check_new_posts(self):
        """新しい投稿をチェック"""
        self._log("新しい投稿をチェック中...")
        
        try:
            # Clawdbot message read コマンドで最新メッセージを取得
            result = subprocess.run(
                [
                    'clawdbot', 'message', 'read',
                    '--channel', self.target_channel_id,
                    '--limit', '10'
                ],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                self._log(f"メッセージ取得エラー: {result.stderr}", 'ERROR')
                return []
            
            # メッセージを解析（出力形式に応じて調整が必要）
            messages = self._parse_messages(result.stdout)
            
            # andoさんからの新しいメッセージをフィルタ
            new_posts = []
            for msg in messages:
                if (msg['author_id'] == self.target_user_id and 
                    msg['id'] not in self.processed_messages and
                    msg.get('attachments')):
                    new_posts.append(msg)
            
            if new_posts:
                self._log(f"新しい投稿を{len(new_posts)}件検知しました")
            
            return new_posts
        
        except subprocess.TimeoutExpired:
            self._log("メッセージ取得タイムアウト", 'ERROR')
            return []
        except Exception as e:
            self._log(f"予期しないエラー: {e}", 'ERROR')
            return []
    
    def _parse_messages(self, output):
        """メッセージ出力を解析"""
        # 出力形式に応じてパースロジックを実装
        # ここでは仮の実装
        messages = []
        
        try:
            # JSON形式で返される場合
            data = json.loads(output)
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and 'messages' in data:
                messages = data['messages']
        except json.JSONDecodeError:
            # テキスト形式の場合は別途パース処理
            pass
        
        return messages
    
    def download_media(self, attachment, post_id):
        """メディアファイルをダウンロード"""
        url = attachment.get('url')
        filename = attachment.get('filename', 'media')
        
        if not url:
            raise ValueError("添付ファイルのURLが見つかりません")
        
        self._log(f"ダウンロード中: {filename}")
        
        # ファイル名を生成
        ext = Path(filename).suffix
        local_filename = self.downloads_dir / f"{post_id}{ext}"
        
        # ダウンロード（リトライ機能付き）
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=60)
                response.raise_for_status()
                
                with open(local_filename, 'wb') as f:
                    f.write(response.content)
                
                self._log(f"ダウンロード完了: {local_filename}")
                return local_filename
            
            except requests.RequestException as e:
                if attempt < max_retries - 1:
                    self._log(f"ダウンロード失敗（リトライ {attempt + 1}/{max_retries}）: {e}", 'WARNING')
                    time.sleep(2 ** attempt)  # 指数バックオフ
                else:
                    raise Exception(f"ダウンロード失敗（最大リトライ回数超過）: {e}")
    
    def process_post(self, message):
        """投稿を処理"""
        message_id = message['id']
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        post_id = f"POST-{timestamp}-{message_id[:8]}"
        
        self._log(f"投稿処理開始: {post_id}")
        
        try:
            # メディアファイルをダウンロード
            attachments = message.get('attachments', [])
            if not attachments:
                self._log("添付ファイルが見つかりません", 'WARNING')
                return False
            
            # 最初の画像・動画を処理
            media_file = None
            for attachment in attachments:
                content_type = attachment.get('content_type', '')
                if content_type.startswith('image/') or content_type.startswith('video/'):
                    media_file = self.download_media(attachment, post_id)
                    break
            
            if not media_file:
                self._log("画像・動画ファイルが見つかりません", 'WARNING')
                return False
            
            # main-workflow.py を実行
            self._log("メインワークフローを実行中...")
            workflow_script = self.skill_dir / 'scripts' / 'main-workflow.py'
            
            result = subprocess.run(
                ['python3', str(workflow_script), str(media_file), post_id],
                capture_output=True,
                text=True,
                timeout=300  # 5分タイムアウト
            )
            
            if result.returncode != 0:
                error_msg = f"ワークフロー実行エラー: {result.stderr}"
                self._log(error_msg, 'ERROR')
                self._notify_discord(f"❌ 処理エラー（{post_id}）\n```\n{result.stderr[:500]}\n```", error=True)
                return False
            
            # ワークフロー結果を解析してSNS URLを取得
            try:
                workflow_result = json.loads(result.stdout)
                sns_urls = workflow_result.get('sns_urls', {})
                
                # エンゲージメント追跡スケジュールに追加
                if sns_urls:
                    self._add_engagement_schedule(post_id, sns_urls)
            except json.JSONDecodeError:
                self._log("ワークフロー結果の解析に失敗（スケジュール追加スキップ）", 'WARNING')
            
            # 成功通知
            self._log(f"投稿処理完了: {post_id}")
            self._notify_discord(
                f"✅ **投稿処理完了っぴ！**\n\n"
                f"📝 投稿ID: `{post_id}`\n"
                f"📊 分析・投稿・記録が完了しました\n"
                f"📈 エンゲージメント追跡スケジュール済み（24h, 48h, 7d後）\n"
                f"🔗 Google Sheetsで詳細を確認できますっぴ！"
            )
            
            # 処理済みとしてマーク
            self.processed_messages.add(message_id)
            self._save_processed_messages()
            
            return True
        
        except subprocess.TimeoutExpired:
            error_msg = f"ワークフロータイムアウト（{post_id}）"
            self._log(error_msg, 'ERROR')
            self._notify_discord(f"❌ {error_msg}\n処理に5分以上かかりました", error=True)
            return False
        
        except Exception as e:
            error_msg = f"予期しないエラー（{post_id}）: {e}"
            self._log(error_msg, 'ERROR')
            self._notify_discord(f"❌ {error_msg}", error=True)
            return False
    
    def _add_engagement_schedule(self, post_id, sns_urls):
        """エンゲージメント追跡スケジュールに追加"""
        self._log(f"エンゲージメント追跡スケジュールに追加中: {post_id}")
        
        try:
            schedule_script = self.skill_dir / 'scripts' / 'schedule-engagement-tracking.py'
            venv_python = self.skill_dir / 'venv' / 'bin' / 'python3'
            
            for platform, url in sns_urls.items():
                if not url:
                    continue
                
                result = subprocess.run(
                    [
                        str(venv_python),
                        str(schedule_script),
                        'add',
                        post_id,
                        platform,
                        url
                    ],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    self._log(f"スケジュール追加成功: {platform} - {url}")
                else:
                    self._log(f"スケジュール追加失敗 ({platform}): {result.stderr}", 'WARNING')
        
        except Exception as e:
            self._log(f"スケジュール追加エラー: {e}", 'ERROR')
    
    def _notify_discord(self, message, error=False):
        """Discordに通知"""
        try:
            emoji = "🔴" if error else "✅"
            
            subprocess.run(
                [
                    'clawdbot', 'message', 'send',
                    '--target', self.target_channel_id,
                    '--message', f"{emoji} {message}"
                ],
                timeout=10
            )
        except Exception as e:
            self._log(f"Discord通知エラー: {e}", 'ERROR')
    
    def run_once(self):
        """1回だけチェックを実行"""
        self._log("=== SNS Growth Tracker: 投稿チェック開始 ===")
        
        new_posts = self.check_new_posts()
        
        if not new_posts:
            self._log("新しい投稿はありません")
            return
        
        for post in new_posts:
            success = self.process_post(post)
            if success:
                # 次の投稿まで少し待機
                time.sleep(5)
        
        self._log("=== チェック完了 ===")
    
    def run_daemon(self, interval=60):
        """デーモンとして実行"""
        self._log(f"=== SNS Growth Tracker: デーモン起動（間隔: {interval}秒）===")
        
        while True:
            try:
                self.run_once()
                time.sleep(interval)
            except KeyboardInterrupt:
                self._log("デーモン停止")
                break
            except Exception as e:
                self._log(f"デーモンエラー: {e}", 'ERROR')
                time.sleep(interval)

def main():
    """メイン関数"""
    watcher = DiscordPostWatcher()
    
    # コマンドライン引数で動作モードを選択
    if len(sys.argv) > 1 and sys.argv[1] == '--daemon':
        interval = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        watcher.run_daemon(interval)
    else:
        watcher.run_once()

if __name__ == '__main__':
    main()
