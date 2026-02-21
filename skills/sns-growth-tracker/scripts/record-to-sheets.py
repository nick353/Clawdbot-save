#!/usr/bin/env python3
"""
Google Sheets記録スクリプト
投稿データとエンゲージメントをGoogle Sheetsに記録
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("❌ Google API クライアントがインストールされていません")
    print("インストール: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)

class SheetsRecorder:
    def __init__(self, credentials_path=None, spreadsheet_id=None):
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CREDENTIALS_PATH', 
            '/root/clawd/skills/sns-growth-tracker/google-credentials.json')
        self.spreadsheet_id = spreadsheet_id or os.getenv('SNS_SHEETS_ID')
        
        if not self.spreadsheet_id:
            raise ValueError("SNS_SHEETS_ID 環境変数が設定されていません")
        
        if not Path(self.credentials_path).exists():
            raise FileNotFoundError(f"認証情報が見つかりません: {self.credentials_path}")
        
        # 認証
        self.credentials = service_account.Credentials.from_service_account_file(
            self.credentials_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        
        self.service = build('sheets', 'v4', credentials=self.credentials)
        self.sheets = self.service.spreadsheets()
    
    def record_post(self, post_data):
        """
        投稿マスターに記録
        
        Args:
            post_data: 投稿データ
                {
                    'post_id': 'POST-20260215-001',
                    'timestamp': '2026-02-15 10:30:00',
                    'media_type': '画像',
                    'analysis': {...},
                    'captions': {...},
                    'image_url': 'https://...',
                    'experiment_id': 'EXP-001'
                }
        
        Returns:
            dict: 記録結果
        """
        try:
            analysis = post_data.get('analysis', {})
            captions = post_data.get('captions', {})
            
            # 投稿マスターのデータを準備
            row = [
                post_data.get('post_id', ''),
                post_data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                post_data.get('media_type', '画像'),
                json.dumps(analysis.get('description', ''), ensure_ascii=False)[:500],
                analysis.get('quality_score', 0),
                ', '.join(analysis.get('recommended_platforms', [])),
                captions.get('X', {}).get('caption', ''),
                captions.get('Threads', {}).get('caption', ''),
                captions.get('Instagram', {}).get('caption', ''),
                captions.get('Facebook', {}).get('caption', ''),
                captions.get('Pinterest', {}).get('caption', ''),
                post_data.get('image_url', ''),
                post_data.get('experiment_id', '')
            ]
            
            # シートに追記
            result = self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='投稿マスター!A:M',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [row]}
            ).execute()
            
            return {
                'success': True,
                'post_id': post_data.get('post_id'),
                'updates': result.get('updates', {})
            }
        
        except HttpError as e:
            return {
                'success': False,
                'error': str(e),
                'post_id': post_data.get('post_id')
            }
    
    def record_sns_urls(self, post_id, sns_urls):
        """
        各SNSの投稿URLを記録
        
        Args:
            post_id: 投稿ID
            sns_urls: SNS別のURL
                {
                    'X': 'https://x.com/...',
                    'Threads': 'https://threads.net/...',
                    'Instagram': 'https://instagram.com/...',
                    'Facebook': 'https://facebook.com/...',
                    'Pinterest': 'https://pinterest.com/...'
                }
        
        Returns:
            dict: 記録結果
        """
        results = {}
        
        for platform, url in sns_urls.items():
            try:
                # シート名を取得
                sheet_name = self._get_sheet_name(platform)
                if not sheet_name:
                    continue
                
                # 投稿IDとURLを記録
                row = [post_id, url]
                
                result = self.sheets.values().append(
                    spreadsheetId=self.spreadsheet_id,
                    range=f'{sheet_name}!A:B',
                    valueInputOption='USER_ENTERED',
                    insertDataOption='INSERT_ROWS',
                    body={'values': [row]}
                ).execute()
                
                results[platform] = {
                    'success': True,
                    'updates': result.get('updates', {})
                }
            
            except HttpError as e:
                results[platform] = {
                    'success': False,
                    'error': str(e)
                }
        
        return results
    
    def record_engagement(self, post_id, platform, engagement_data):
        """
        エンゲージメントデータを記録（手動記入の補助）
        
        Args:
            post_id: 投稿ID
            platform: SNSプラットフォーム
            engagement_data: エンゲージメントデータ
                {
                    'likes': 100,
                    'comments': 10,
                    'shares': 5,
                    'impressions': 1000
                }
        
        Returns:
            dict: 記録結果
        """
        try:
            sheet_name = self._get_sheet_name(platform)
            if not sheet_name:
                return {'success': False, 'error': f'不明なプラットフォーム: {platform}'}
            
            # 既存の行を検索
            range_name = f'{sheet_name}!A:A'
            result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range=range_name
            ).execute()
            
            values = result.get('values', [])
            row_index = None
            
            # post_idを検索
            for i, row in enumerate(values):
                if row and row[0] == post_id:
                    row_index = i + 1  # 1-indexed
                    break
            
            if row_index is None:
                return {'success': False, 'error': f'投稿ID {post_id} が見つかりません'}
            
            # プラットフォームごとにデータを準備
            update_data = self._format_engagement_data(platform, engagement_data)
            
            # データを更新
            update_range = f'{sheet_name}!C{row_index}:F{row_index}'
            update_result = self.sheets.values().update(
                spreadsheetId=self.spreadsheet_id,
                range=update_range,
                valueInputOption='USER_ENTERED',
                body={'values': [update_data]}
            ).execute()
            
            return {
                'success': True,
                'platform': platform,
                'post_id': post_id,
                'row_index': row_index,
                'updates': update_result.get('updatedCells', 0)
            }
        
        except HttpError as e:
            return {
                'success': False,
                'error': str(e),
                'platform': platform,
                'post_id': post_id
            }
    
    def record_trend(self, trend_data):
        """
        トレンド分析結果を記録
        
        Args:
            trend_data: トレンドデータ
                {
                    'date': '2026-02-15',
                    'platform': 'Instagram',
                    'url': 'https://...',
                    'likes': 10000,
                    'comments': 500,
                    'shares': 200,
                    'analysis': {...},
                    'learnings': [...]
                }
        
        Returns:
            dict: 記録結果
        """
        try:
            analysis = trend_data.get('analysis', {})
            
            row = [
                trend_data.get('date', datetime.now().strftime('%Y-%m-%d')),
                trend_data.get('platform', ''),
                trend_data.get('url', ''),
                trend_data.get('likes', 0),
                trend_data.get('comments', 0),
                trend_data.get('shares', 0),
                json.dumps(analysis.get('why_viral', ''), ensure_ascii=False)[:500],
                ', '.join(analysis.get('engagement_factors', [])),
                ', '.join(analysis.get('learnings', [])),
                '',  # テスト状況（手動記入）
                ''   # テスト結果（手動記入）
            ]
            
            result = self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='トレンド分析!A:K',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [row]}
            ).execute()
            
            return {
                'success': True,
                'trend_date': trend_data.get('date'),
                'platform': trend_data.get('platform'),
                'updates': result.get('updates', {})
            }
        
        except HttpError as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def record_experiment(self, experiment_data):
        """
        実験ログを記録
        
        Args:
            experiment_data: 実験データ
        
        Returns:
            dict: 記録結果
        """
        try:
            row = [
                experiment_data.get('experiment_id', ''),
                experiment_data.get('description', ''),
                experiment_data.get('hypothesis', ''),
                experiment_data.get('date', datetime.now().strftime('%Y-%m-%d')),
                experiment_data.get('test_post_id', ''),
                experiment_data.get('control_post_id', ''),
                experiment_data.get('test_result', 0),
                experiment_data.get('control_result', 0),
                experiment_data.get('difference', 0),
                experiment_data.get('conclusion', ''),
                experiment_data.get('continue', '')
            ]
            
            result = self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='実験ログ!A:K',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [row]}
            ).execute()
            
            return {
                'success': True,
                'experiment_id': experiment_data.get('experiment_id'),
                'updates': result.get('updates', {})
            }
        
        except HttpError as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def record_weekly_report(self, report_data):
        """
        週次レポートを記録
        
        Args:
            report_data: レポートデータ
        
        Returns:
            dict: 記録結果
        """
        try:
            row = [
                report_data.get('week', ''),
                report_data.get('period', ''),
                report_data.get('total_posts', 0),
                report_data.get('experiments', 0),
                report_data.get('best_post_id', ''),
                report_data.get('best_platform', ''),
                report_data.get('avg_engagement', 0),
                report_data.get('learnings', ''),
                report_data.get('next_week_strategy', '')
            ]
            
            result = self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='週次レポート!A:I',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [row]}
            ).execute()
            
            return {
                'success': True,
                'week': report_data.get('week'),
                'updates': result.get('updates', {})
            }
        
        except HttpError as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_sheet_name(self, platform):
        """プラットフォーム名からシート名を取得"""
        sheet_names = {
            'X': 'X (Twitter)',
            'Threads': 'Threads',
            'Instagram': 'Instagram',
            'Facebook': 'Facebook',
            'Pinterest': 'Pinterest'
        }
        return sheet_names.get(platform)
    
    def _format_engagement_data(self, platform, data):
        """プラットフォームごとにエンゲージメントデータをフォーマット"""
        if platform == 'X':
            return [
                data.get('likes', 0),
                data.get('retweets', 0),
                data.get('replies', 0),
                data.get('impressions', 0)
            ]
        elif platform == 'Threads':
            return [
                data.get('likes', 0),
                data.get('reposts', 0),
                data.get('replies', 0),
                data.get('views', 0)
            ]
        elif platform == 'Instagram':
            return [
                data.get('likes', 0),
                data.get('comments', 0),
                data.get('saves', 0),
                data.get('shares', 0),
                data.get('reach', 0)
            ]
        elif platform == 'Facebook':
            return [
                data.get('likes', 0),
                data.get('comments', 0),
                data.get('shares', 0),
                data.get('reach', 0)
            ]
        elif platform == 'Pinterest':
            return [
                data.get('saves', 0),
                data.get('clicks', 0),
                data.get('impressions', 0)
            ]
        return []

def main():
    """メイン関数"""
    if len(sys.argv) < 3:
        print("使い方: python record-to-sheets.py <action> <data_json>")
        print("action: post, sns_urls, engagement, trend, experiment, weekly_report")
        sys.exit(1)
    
    action = sys.argv[1]
    data_file = sys.argv[2]
    
    try:
        # データを読み込み
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        recorder = SheetsRecorder()
        
        # アクションに応じて記録
        if action == 'post':
            result = recorder.record_post(data)
        elif action == 'sns_urls':
            result = recorder.record_sns_urls(data['post_id'], data['urls'])
        elif action == 'engagement':
            result = recorder.record_engagement(data['post_id'], data['platform'], data['engagement'])
        elif action == 'trend':
            result = recorder.record_trend(data)
        elif action == 'experiment':
            result = recorder.record_experiment(data)
        elif action == 'weekly_report':
            result = recorder.record_weekly_report(data)
        else:
            result = {'success': False, 'error': f'不明なアクション: {action}'}
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'action': action
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
