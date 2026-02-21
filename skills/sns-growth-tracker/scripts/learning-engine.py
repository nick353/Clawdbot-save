#!/usr/bin/env python3
"""
学習エンジンスクリプト
過去データから成功パターンを学習し、次回投稿の最適化提案を生成
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("❌ Google API クライアントがインストールされていません")
    sys.exit(1)

class LearningEngine:
    def __init__(self, credentials_path=None, spreadsheet_id=None):
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CREDENTIALS_PATH',
            '/root/clawd/skills/sns-growth-tracker/google-credentials.json')
        self.spreadsheet_id = spreadsheet_id or os.getenv('SNS_SHEETS_ID')
        
        if not self.spreadsheet_id:
            raise ValueError("SNS_SHEETS_ID 環境変数が設定されていません")
        
        # 認証
        self.credentials = service_account.Credentials.from_service_account_file(
            self.credentials_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
        )
        
        self.service = build('sheets', 'v4', credentials=self.credentials)
        self.sheets = self.service.spreadsheets()
    
    def learn_from_past_data(self, days=30):
        """
        過去データから学習
        
        Args:
            days: 過去何日分のデータを分析するか
        
        Returns:
            dict: 学習結果
        """
        # 投稿マスターとSNS別データを取得
        posts = self._get_posts_data(days)
        engagement = self._get_engagement_data(days)
        
        # データを統合
        integrated_data = self._integrate_data(posts, engagement)
        
        # パターン分析
        patterns = self._analyze_patterns(integrated_data)
        
        # 推奨事項を生成
        recommendations = self._generate_recommendations(patterns)
        
        return {
            'learning_date': datetime.now().isoformat(),
            'data_period_days': days,
            'total_posts': len(integrated_data),
            'patterns': patterns,
            'recommendations': recommendations
        }
    
    def _get_posts_data(self, days):
        """投稿マスターからデータ取得"""
        try:
            result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='投稿マスター!A:M'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            headers = values[0]
            posts = []
            
            cutoff_date = datetime.now() - timedelta(days=days)
            
            for row in values[1:]:
                if len(row) < len(headers):
                    row = row + [''] * (len(headers) - len(row))
                
                post = dict(zip(headers, row))
                
                # 日付フィルター
                try:
                    post_date = datetime.strptime(post['投稿日時'], '%Y-%m-%d %H:%M:%S')
                    if post_date >= cutoff_date:
                        posts.append(post)
                except:
                    continue
            
            return posts
        
        except HttpError as e:
            print(f"❌ 投稿データ取得エラー: {e}")
            return []
    
    def _get_engagement_data(self, days):
        """SNS別エンゲージメントデータ取得"""
        engagement = {}
        
        for platform in ['X (Twitter)', 'Threads', 'Instagram', 'Facebook', 'Pinterest']:
            try:
                result = self.sheets.values().get(
                    spreadsheetId=self.spreadsheet_id,
                    range=f'{platform}!A:H'
                ).execute()
                
                values = result.get('values', [])
                if not values:
                    continue
                
                headers = values[0]
                
                for row in values[1:]:
                    if len(row) < 2:
                        continue
                    
                    if len(row) < len(headers):
                        row = row + [''] * (len(headers) - len(row))
                    
                    post_id = row[0]
                    data = dict(zip(headers, row))
                    
                    if post_id not in engagement:
                        engagement[post_id] = {}
                    
                    engagement[post_id][platform] = data
            
            except HttpError as e:
                print(f"⚠️  {platform}データ取得エラー: {e}")
                continue
        
        return engagement
    
    def _integrate_data(self, posts, engagement):
        """投稿データとエンゲージメントデータを統合"""
        integrated = []
        
        for post in posts:
            post_id = post['投稿ID']
            
            if post_id in engagement:
                post['engagement'] = engagement[post_id]
                integrated.append(post)
        
        return integrated
    
    def _analyze_patterns(self, data):
        """パターン分析"""
        patterns = {
            'by_theme': defaultdict(list),
            'by_platform': defaultdict(list),
            'by_time': defaultdict(list),
            'by_media_type': defaultdict(list)
        }
        
        for post in data:
            theme = post.get('Gemini分析', '')[:50]  # テーマの最初の50文字
            media_type = post.get('メディア種別', '')
            
            # 時間帯別
            try:
                post_time = datetime.strptime(post['投稿日時'], '%Y-%m-%d %H:%M:%S')
                hour = post_time.hour
                time_slot = self._get_time_slot(hour)
                
                # エンゲージメント率を計算
                eng_data = post.get('engagement', {})
                avg_engagement = self._calculate_avg_engagement(eng_data)
                
                patterns['by_time'][time_slot].append(avg_engagement)
            except:
                pass
            
            # テーマ別
            if theme:
                eng_data = post.get('engagement', {})
                avg_engagement = self._calculate_avg_engagement(eng_data)
                patterns['by_theme'][theme].append(avg_engagement)
            
            # メディアタイプ別
            if media_type:
                eng_data = post.get('engagement', {})
                avg_engagement = self._calculate_avg_engagement(eng_data)
                patterns['by_media_type'][media_type].append(avg_engagement)
            
            # プラットフォーム別
            eng_data = post.get('engagement', {})
            for platform, data in eng_data.items():
                try:
                    eng_rate = float(data.get('エンゲージメント率', 0))
                    patterns['by_platform'][platform].append(eng_rate)
                except:
                    pass
        
        # 平均を計算
        summary = {
            'by_theme': {theme: sum(rates)/len(rates) if rates else 0 
                        for theme, rates in patterns['by_theme'].items()},
            'by_platform': {platform: sum(rates)/len(rates) if rates else 0 
                           for platform, rates in patterns['by_platform'].items()},
            'by_time': {time: sum(rates)/len(rates) if rates else 0 
                       for time, rates in patterns['by_time'].items()},
            'by_media_type': {media: sum(rates)/len(rates) if rates else 0 
                             for media, rates in patterns['by_media_type'].items()}
        }
        
        return summary
    
    def _get_time_slot(self, hour):
        """時間帯を分類"""
        if 6 <= hour < 12:
            return '朝 (6-12時)'
        elif 12 <= hour < 18:
            return '昼 (12-18時)'
        elif 18 <= hour < 24:
            return '夜 (18-24時)'
        else:
            return '深夜 (0-6時)'
    
    def _calculate_avg_engagement(self, eng_data):
        """平均エンゲージメント率を計算"""
        rates = []
        
        for platform, data in eng_data.items():
            try:
                rate = float(data.get('エンゲージメント率', 0))
                if rate > 0:
                    rates.append(rate)
            except:
                pass
        
        return sum(rates) / len(rates) if rates else 0
    
    def _generate_recommendations(self, patterns):
        """推奨事項を生成"""
        recommendations = []
        
        # 最適プラットフォーム
        platform_scores = patterns['by_platform']
        if platform_scores:
            best_platform = max(platform_scores, key=platform_scores.get)
            recommendations.append({
                'type': '最適プラットフォーム',
                'recommendation': f'{best_platform} が最高のエンゲージメント率（{platform_scores[best_platform]:.2f}%）',
                'priority': 'high'
            })
        
        # 最適投稿時間
        time_scores = patterns['by_time']
        if time_scores:
            best_time = max(time_scores, key=time_scores.get)
            recommendations.append({
                'type': '最適投稿時間',
                'recommendation': f'{best_time} が最高のエンゲージメント率（{time_scores[best_time]:.2f}%）',
                'priority': 'medium'
            })
        
        # 最適メディアタイプ
        media_scores = patterns['by_media_type']
        if media_scores:
            best_media = max(media_scores, key=media_scores.get)
            recommendations.append({
                'type': '最適メディアタイプ',
                'recommendation': f'{best_media} が最高のエンゲージメント率（{media_scores[best_media]:.2f}%）',
                'priority': 'medium'
            })
        
        # テーマ別の傾向
        theme_scores = patterns['by_theme']
        if theme_scores:
            sorted_themes = sorted(theme_scores.items(), key=lambda x: x[1], reverse=True)[:3]
            recommendations.append({
                'type': '効果的なテーマ',
                'recommendation': '、'.join([f'{theme}（{score:.2f}%）' for theme, score in sorted_themes]),
                'priority': 'low'
            })
        
        return recommendations

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使い方: python learning-engine.py <days>")
        print("days: 過去何日分のデータを分析するか（デフォルト: 30）")
        sys.exit(1)
    
    days = int(sys.argv[1]) if sys.argv[1].isdigit() else 30
    
    try:
        engine = LearningEngine()
        result = engine.learn_from_past_data(days)
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'days': days
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
