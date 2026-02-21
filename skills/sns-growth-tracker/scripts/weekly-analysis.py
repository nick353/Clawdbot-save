#!/usr/bin/env python3
"""
週次分析スクリプト
過去1週間のデータを分析し、レポートを生成
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

# learning-engine.py をインポート
sys.path.append(str(Path(__file__).parent))
from learning_engine import LearningEngine

class WeeklyAnalyzer:
    def __init__(self, credentials_path=None, spreadsheet_id=None):
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CREDENTIALS_PATH',
            '/root/clawd/skills/sns-growth-tracker/google-credentials.json')
        self.spreadsheet_id = spreadsheet_id or os.getenv('SNS_SHEETS_ID')
        
        if not self.spreadsheet_id:
            raise ValueError("SNS_SHEETS_ID 環境変数が設定されていません")
        
        # 認証
        self.credentials = service_account.Credentials.from_service_account_file(
            self.credentials_path,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        
        self.service = build('sheets', 'v4', credentials=self.credentials)
        self.sheets = self.service.spreadsheets()
        
        # 学習エンジン
        self.learning_engine = LearningEngine(credentials_path, spreadsheet_id)
    
    def analyze_week(self, week_offset=0):
        """
        週次分析を実行
        
        Args:
            week_offset: 0=今週、1=先週、2=先々週...
        
        Returns:
            dict: 分析結果
        """
        # 週の開始日と終了日を計算
        today = datetime.now()
        monday = today - timedelta(days=today.weekday() + (7 * week_offset))
        sunday = monday + timedelta(days=6)
        
        period = f"{monday.strftime('%Y-%m-%d')} ～ {sunday.strftime('%Y-%m-%d')}"
        week_number = monday.isocalendar()[1]
        
        # データ取得
        posts = self._get_week_posts(monday, sunday)
        experiments = self._get_week_experiments(monday, sunday)
        trends = self._get_week_trends(monday, sunday)
        
        # 分析
        platform_performance = self._analyze_platform_performance(posts)
        best_post = self._find_best_post(posts)
        worst_post = self._find_worst_post(posts)
        learnings = self._extract_learnings(posts, trends)
        
        # 学習エンジンから推奨事項
        learning_result = self.learning_engine.learn_from_past_data(days=30)
        
        # 次週の戦略
        next_week_strategy = self._generate_next_week_strategy(
            platform_performance,
            learnings,
            learning_result['recommendations']
        )
        
        # レポート生成
        report = {
            'week': f"{monday.year}年 第{week_number}週",
            'period': period,
            'total_posts': len(posts),
            'experiments': len(experiments),
            'platform_performance': platform_performance,
            'best_post': best_post,
            'worst_post': worst_post,
            'learnings': learnings,
            'trends_discovered': len(trends),
            'next_week_strategy': next_week_strategy,
            'generated_at': datetime.now().isoformat()
        }
        
        # レポートを保存
        self._save_report(report, monday)
        
        # Google Sheetsに記録
        self._record_to_sheets(report)
        
        return report
    
    def _get_week_posts(self, start_date, end_date):
        """週の投稿データを取得"""
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
            
            for row in values[1:]:
                if len(row) < len(headers):
                    row = row + [''] * (len(headers) - len(row))
                
                post = dict(zip(headers, row))
                
                try:
                    post_date = datetime.strptime(post['投稿日時'], '%Y-%m-%d %H:%M:%S')
                    if start_date <= post_date <= end_date:
                        # エンゲージメントデータを取得
                        post['engagement'] = self._get_post_engagement(post['投稿ID'])
                        posts.append(post)
                except:
                    continue
            
            return posts
        
        except HttpError as e:
            print(f"❌ 投稿データ取得エラー: {e}")
            return []
    
    def _get_post_engagement(self, post_id):
        """投稿のエンゲージメントデータを取得"""
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
                    
                    if row[0] == post_id:
                        if len(row) < len(headers):
                            row = row + [''] * (len(headers) - len(row))
                        
                        engagement[platform] = dict(zip(headers, row))
                        break
            
            except:
                continue
        
        return engagement
    
    def _get_week_experiments(self, start_date, end_date):
        """週の実験データを取得"""
        try:
            result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='実験ログ!A:K'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            headers = values[0]
            experiments = []
            
            for row in values[1:]:
                if len(row) < len(headers):
                    row = row + [''] * (len(headers) - len(row))
                
                exp = dict(zip(headers, row))
                
                try:
                    exp_date = datetime.strptime(exp['実施日'], '%Y-%m-%d')
                    if start_date.date() <= exp_date.date() <= end_date.date():
                        experiments.append(exp)
                except:
                    continue
            
            return experiments
        
        except HttpError as e:
            return []
    
    def _get_week_trends(self, start_date, end_date):
        """週のトレンドデータを取得"""
        try:
            result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range='トレンド分析!A:K'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            headers = values[0]
            trends = []
            
            for row in values[1:]:
                if len(row) < len(headers):
                    row = row + [''] * (len(headers) - len(row))
                
                trend = dict(zip(headers, row))
                
                try:
                    trend_date = datetime.strptime(trend['分析日'], '%Y-%m-%d')
                    if start_date.date() <= trend_date.date() <= end_date.date():
                        trends.append(trend)
                except:
                    continue
            
            return trends
        
        except HttpError as e:
            return []
    
    def _analyze_platform_performance(self, posts):
        """プラットフォーム別パフォーマンス分析"""
        performance = {}
        
        for platform in ['X (Twitter)', 'Threads', 'Instagram', 'Facebook', 'Pinterest']:
            rates = []
            
            for post in posts:
                engagement = post.get('engagement', {})
                if platform in engagement:
                    try:
                        rate = float(engagement[platform].get('エンゲージメント率', 0))
                        if rate > 0:
                            rates.append(rate)
                    except:
                        pass
            
            if rates:
                performance[platform] = {
                    'avg_engagement': sum(rates) / len(rates),
                    'posts_count': len(rates),
                    'best_rate': max(rates),
                    'worst_rate': min(rates)
                }
            else:
                performance[platform] = {
                    'avg_engagement': 0,
                    'posts_count': 0,
                    'best_rate': 0,
                    'worst_rate': 0
                }
        
        return performance
    
    def _find_best_post(self, posts):
        """最高パフォーマンス投稿を特定"""
        best_post = None
        best_rate = 0
        
        for post in posts:
            engagement = post.get('engagement', {})
            avg_rate = 0
            count = 0
            
            for platform, data in engagement.items():
                try:
                    rate = float(data.get('エンゲージメント率', 0))
                    if rate > 0:
                        avg_rate += rate
                        count += 1
                except:
                    pass
            
            if count > 0:
                avg_rate /= count
                if avg_rate > best_rate:
                    best_rate = avg_rate
                    best_post = {
                        'post_id': post['投稿ID'],
                        'date': post['投稿日時'],
                        'theme': post.get('Gemini分析', '')[:100],
                        'avg_engagement_rate': avg_rate,
                        'engagement': engagement
                    }
        
        return best_post
    
    def _find_worst_post(self, posts):
        """最低パフォーマンス投稿を特定"""
        worst_post = None
        worst_rate = float('inf')
        
        for post in posts:
            engagement = post.get('engagement', {})
            avg_rate = 0
            count = 0
            
            for platform, data in engagement.items():
                try:
                    rate = float(data.get('エンゲージメント率', 0))
                    if rate > 0:
                        avg_rate += rate
                        count += 1
                except:
                    pass
            
            if count > 0:
                avg_rate /= count
                if avg_rate < worst_rate:
                    worst_rate = avg_rate
                    worst_post = {
                        'post_id': post['投稿ID'],
                        'date': post['投稿日時'],
                        'theme': post.get('Gemini分析', '')[:100],
                        'avg_engagement_rate': avg_rate
                    }
        
        return worst_post
    
    def _extract_learnings(self, posts, trends):
        """学びを抽出"""
        learnings = []
        
        # トレンドから学び
        for trend in trends:
            learning = trend.get('学んだこと', '')
            if learning:
                learnings.append(learning)
        
        # パターン分析から学び
        if posts:
            # テーマ別のエンゲージメント
            theme_performance = defaultdict(list)
            
            for post in posts:
                theme = post.get('Gemini分析', '')[:50]
                engagement = post.get('engagement', {})
                
                for platform, data in engagement.items():
                    try:
                        rate = float(data.get('エンゲージメント率', 0))
                        if rate > 0:
                            theme_performance[theme].append(rate)
                    except:
                        pass
            
            # 最も効果的なテーマ
            if theme_performance:
                best_theme = max(theme_performance, key=lambda x: sum(theme_performance[x])/len(theme_performance[x]))
                avg_rate = sum(theme_performance[best_theme]) / len(theme_performance[best_theme])
                learnings.append(f"{best_theme} が最も効果的（平均{avg_rate:.2f}%）")
        
        return learnings[:5]  # 上位5個
    
    def _generate_next_week_strategy(self, performance, learnings, recommendations):
        """次週の戦略を生成"""
        strategies = []
        
        # パフォーマンスが良いプラットフォームに注力
        sorted_platforms = sorted(
            performance.items(),
            key=lambda x: x[1]['avg_engagement'],
            reverse=True
        )
        
        if sorted_platforms:
            best_platform = sorted_platforms[0][0]
            strategies.append(f"{best_platform}に注力（平均エンゲージメント{sorted_platforms[0][1]['avg_engagement']:.2f}%）")
        
        # 学習エンジンからの推奨事項
        for rec in recommendations[:3]:
            if rec['priority'] in ['high', 'medium']:
                strategies.append(rec['recommendation'])
        
        # 学びを戦略に反映
        for learning in learnings[:2]:
            strategies.append(f"継続: {learning}")
        
        return strategies
    
    def _save_report(self, report, monday):
        """レポートをファイルに保存"""
        report_dir = Path(__file__).parent.parent / 'data' / 'reports'
        report_dir.mkdir(parents=True, exist_ok=True)
        
        report_file = report_dir / f"report-{monday.strftime('%Y-%m-%d')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # Markdown形式でも保存
        md_file = report_dir / f"report-{monday.strftime('%Y-%m-%d')}.md"
        md_content = self._format_report_markdown(report)
        
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        # latest-report.md を更新
        latest_file = report_dir / 'latest-report.md'
        with open(latest_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
    
    def _format_report_markdown(self, report):
        """Markdown形式でレポート整形"""
        md = f"""# 📊 SNS成長レポート（{report['week']}）

**期間**: {report['period']}  
**生成日時**: {datetime.fromisoformat(report['generated_at']).strftime('%Y-%m-%d %H:%M')}

---

## 📈 総合結果

- **総投稿数**: {report['total_posts']}件
- **実験数**: {report['experiments']}件
- **トレンド発見**: {report['trends_discovered']}件

---

## 🏆 プラットフォーム別パフォーマンス

"""
        
        # プラットフォーム別パフォーマンス
        for platform, perf in report['platform_performance'].items():
            md += f"### {platform}\n"
            md += f"- 平均エンゲージメント率: **{perf['avg_engagement']:.2f}%**\n"
            md += f"- 投稿数: {perf['posts_count']}件\n"
            md += f"- 最高: {perf['best_rate']:.2f}% / 最低: {perf['worst_rate']:.2f}%\n\n"
        
        # ベスト投稿
        if report['best_post']:
            best = report['best_post']
            md += f"""---

## 🌟 ベスト投稿

**投稿ID**: {best['post_id']}  
**投稿日時**: {best['date']}  
**平均エンゲージメント率**: {best['avg_engagement_rate']:.2f}%

**内容**: {best['theme']}

"""
        
        # 学び
        if report['learnings']:
            md += "---\n\n## 📚 今週の学び\n\n"
            for i, learning in enumerate(report['learnings'], 1):
                md += f"{i}. {learning}\n"
            md += "\n"
        
        # 次週の戦略
        if report['next_week_strategy']:
            md += "---\n\n## 🎯 来週の戦略\n\n"
            for i, strategy in enumerate(report['next_week_strategy'], 1):
                md += f"{i}. {strategy}\n"
            md += "\n"
        
        md += "---\n\n*自動生成レポート by SNS Growth Tracker*\n"
        
        return md
    
    def _record_to_sheets(self, report):
        """Google Sheetsに記録"""
        try:
            row = [
                report['week'],
                report['period'],
                report['total_posts'],
                report['experiments'],
                report.get('best_post', {}).get('post_id', ''),
                self._get_best_platform(report['platform_performance']),
                self._get_avg_engagement(report['platform_performance']),
                '\n'.join(report['learnings']),
                '\n'.join(report['next_week_strategy'])
            ]
            
            self.sheets.values().append(
                spreadsheetId=self.spreadsheet_id,
                range='週次レポート!A:I',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [row]}
            ).execute()
        
        except HttpError as e:
            print(f"⚠️  Google Sheets記録エラー: {e}")
    
    def _get_best_platform(self, performance):
        """最高パフォーマンスのプラットフォームを取得"""
        if not performance:
            return ''
        
        best = max(performance.items(), key=lambda x: x[1]['avg_engagement'])
        return best[0]
    
    def _get_avg_engagement(self, performance):
        """全体の平均エンゲージメント率を計算"""
        if not performance:
            return 0
        
        rates = [p['avg_engagement'] for p in performance.values() if p['avg_engagement'] > 0]
        return sum(rates) / len(rates) if rates else 0

def main():
    """メイン関数"""
    week_offset = 0
    if len(sys.argv) > 1:
        week_offset = int(sys.argv[1])
    
    try:
        analyzer = WeeklyAnalyzer()
        report = analyzer.analyze_week(week_offset)
        
        print(json.dumps(report, ensure_ascii=False, indent=2))
    
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'week_offset': week_offset
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
