#!/usr/bin/env python3
"""
実験計画スクリプト
A/Bテストと仮説検証の計画・管理
"""

import os
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta

try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai がインストールされていません")
    sys.exit(1)

class ExperimentPlanner:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY が設定されていません")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
        
        # config.json を読み込み
        config_path = Path(__file__).parent.parent / 'config.json'
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.data_dir = Path(self.config['paths']['experiments_dir'])
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def create_experiment(self, hypothesis, test_type, platforms=None):
        """
        実験を作成
        
        Args:
            hypothesis: 仮説（例: "質問型キャプションはエンゲージメントを増やす"）
            test_type: 実験タイプ（caption, visual, timing, hashtag など）
            platforms: 対象プラットフォーム（省略時は全プラットフォーム）
        
        Returns:
            dict: 実験計画
        """
        experiment_id = f"EXP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
        
        platforms = platforms or self.config['sns']['platforms']
        
        # Geminiで実験計画を生成
        experiment_plan = self._generate_experiment_plan(
            experiment_id, hypothesis, test_type, platforms
        )
        
        # 実験データを保存
        experiment_data = {
            'experiment_id': experiment_id,
            'hypothesis': hypothesis,
            'test_type': test_type,
            'platforms': platforms,
            'plan': experiment_plan,
            'status': 'planned',
            'created_at': datetime.now().isoformat(),
            'test_posts': [],
            'control_posts': [],
            'results': None
        }
        
        self._save_experiment(experiment_data)
        
        return experiment_data
    
    def _generate_experiment_plan(self, experiment_id, hypothesis, test_type, platforms):
        """
        Geminiで実験計画を生成
        
        Args:
            experiment_id: 実験ID
            hypothesis: 仮説
            test_type: 実験タイプ
            platforms: プラットフォームリスト
        
        Returns:
            dict: 実験計画
        """
        prompt = f"""SNS投稿のA/Bテスト実験計画を作成してください。

【実験情報】
- 実験ID: {experiment_id}
- 仮説: {hypothesis}
- 実験タイプ: {test_type}
- 対象プラットフォーム: {', '.join(platforms)}

【実験設定】
- テスト期間: {self.config['experiments']['test_duration_days']}日間
- 成功判定: 対照群より{self.config['experiments']['success_threshold']}倍以上のエンゲージメント

以下のJSON形式で実験計画を作成してください：

{{
  "description": "実験の詳細説明",
  "test_condition": "テスト条件（例: 質問型キャプション）",
  "control_condition": "対照条件（例: 通常のキャプション）",
  "variables": [
    {{
      "name": "変数名",
      "test_value": "テスト値",
      "control_value": "対照値"
    }}
  ],
  "metrics": [
    {{
      "name": "メトリクス名",
      "description": "説明",
      "success_threshold": 1.15
    }}
  ],
  "implementation_steps": [
    "ステップ1",
    "ステップ2",
    "ステップ3"
  ],
  "expected_outcome": "期待される結果",
  "risks": [
    "リスク1",
    "リスク2"
  ],
  "duration_days": 3
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(response.text)
            return result
        except Exception as e:
            print(f"⚠️  実験計画生成エラー: {e}", file=sys.stderr)
            return {
                'description': hypothesis,
                'test_condition': test_type,
                'control_condition': 'baseline',
                'variables': [],
                'metrics': [],
                'implementation_steps': [],
                'expected_outcome': '',
                'risks': [],
                'duration_days': self.config['experiments']['test_duration_days']
            }
    
    def add_test_post(self, experiment_id, post_id, condition='test'):
        """
        実験に投稿を追加
        
        Args:
            experiment_id: 実験ID
            post_id: 投稿ID
            condition: テスト条件（'test' または 'control'）
        
        Returns:
            dict: 更新結果
        """
        experiment = self._load_experiment(experiment_id)
        
        if not experiment:
            return {'success': False, 'error': f'実験が見つかりません: {experiment_id}'}
        
        if condition == 'test':
            experiment['test_posts'].append({
                'post_id': post_id,
                'added_at': datetime.now().isoformat()
            })
        elif condition == 'control':
            experiment['control_posts'].append({
                'post_id': post_id,
                'added_at': datetime.now().isoformat()
            })
        else:
            return {'success': False, 'error': f'不明な条件: {condition}'}
        
        # ステータス更新
        if experiment['status'] == 'planned':
            experiment['status'] = 'running'
            experiment['started_at'] = datetime.now().isoformat()
        
        self._save_experiment(experiment)
        
        return {
            'success': True,
            'experiment_id': experiment_id,
            'post_id': post_id,
            'condition': condition
        }
    
    def evaluate_experiment(self, experiment_id, engagement_data):
        """
        実験を評価
        
        Args:
            experiment_id: 実験ID
            engagement_data: エンゲージメントデータ
                {
                    'test': {'avg_engagement': 15.5, 'total_posts': 3},
                    'control': {'avg_engagement': 12.0, 'total_posts': 3}
                }
        
        Returns:
            dict: 評価結果
        """
        experiment = self._load_experiment(experiment_id)
        
        if not experiment:
            return {'success': False, 'error': f'実験が見つかりません: {experiment_id}'}
        
        # Geminiで評価
        evaluation = self._generate_evaluation(experiment, engagement_data)
        
        # 実験データを更新
        experiment['results'] = {
            'engagement_data': engagement_data,
            'evaluation': evaluation,
            'evaluated_at': datetime.now().isoformat()
        }
        experiment['status'] = 'completed'
        
        self._save_experiment(experiment)
        
        return {
            'success': True,
            'experiment_id': experiment_id,
            'evaluation': evaluation
        }
    
    def _generate_evaluation(self, experiment, engagement_data):
        """
        Geminiで実験評価を生成
        
        Args:
            experiment: 実験データ
            engagement_data: エンゲージメントデータ
        
        Returns:
            dict: 評価結果
        """
        test_avg = engagement_data.get('test', {}).get('avg_engagement', 0)
        control_avg = engagement_data.get('control', {}).get('avg_engagement', 0)
        
        if control_avg > 0:
            improvement = ((test_avg - control_avg) / control_avg) * 100
        else:
            improvement = 0
        
        prompt = f"""A/Bテストの結果を評価してください。

【実験情報】
- 仮説: {experiment['hypothesis']}
- テスト条件: {experiment['plan'].get('test_condition', '')}
- 対照条件: {experiment['plan'].get('control_condition', '')}

【結果】
- テストグループ平均エンゲージメント: {test_avg}%
- 対照グループ平均エンゲージメント: {control_avg}%
- 改善率: {improvement:.1f}%
- 成功判定基準: {self.config['experiments']['success_threshold']}倍以上

【データ】
{json.dumps(engagement_data, ensure_ascii=False, indent=2)}

以下のJSON形式で評価してください：

{{
  "conclusion": "結論",
  "success": true,
  "improvement_rate": {improvement:.1f},
  "confidence_score": 85,
  "learnings": [
    "学び1",
    "学び2",
    "学び3"
  ],
  "recommendations": [
    "推奨事項1",
    "推奨事項2"
  ],
  "continue_strategy": "継続するか、変更するか",
  "next_experiments": [
    "次の実験アイデア1",
    "次の実験アイデア2"
  ]
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(response.text)
            
            # 基本データを追加
            result['test_avg'] = test_avg
            result['control_avg'] = control_avg
            result['improvement_rate'] = improvement
            
            return result
        except Exception as e:
            print(f"⚠️  評価生成エラー: {e}", file=sys.stderr)
            return {
                'conclusion': '評価エラー',
                'success': False,
                'improvement_rate': improvement,
                'confidence_score': 0,
                'learnings': [],
                'recommendations': [],
                'continue_strategy': 'unknown',
                'next_experiments': []
            }
    
    def get_active_experiments(self):
        """
        実行中の実験を取得
        
        Returns:
            list: 実験データのリスト
        """
        experiments = []
        
        for file in self.data_dir.glob('EXP-*.json'):
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data.get('status') in ['planned', 'running']:
                    experiments.append(data)
        
        return experiments
    
    def suggest_next_experiment(self, past_results=None):
        """
        次の実験を提案
        
        Args:
            past_results: 過去の実験結果（オプション）
        
        Returns:
            dict: 実験提案
        """
        # 過去の実験を読み込み
        if past_results is None:
            past_results = self._load_completed_experiments()
        
        prompt = f"""過去の実験結果に基づいて、次のA/Bテスト実験を提案してください。

【設定可能なパターン】
{json.dumps(self.config['learning']['patterns_to_track'], ensure_ascii=False, indent=2)}

【過去の実験結果】
{json.dumps(past_results[-10:], ensure_ascii=False, indent=2)[:5000]}

以下のJSON形式で3つの実験を提案してください：

{{
  "experiments": [
    {{
      "hypothesis": "仮説",
      "test_type": "caption|visual|timing|hashtag",
      "priority": "high|medium|low",
      "reasoning": "なぜこの実験を行うべきか",
      "expected_impact": "期待される効果"
    }}
  ]
}}"""
        
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(response.text)
            return result
        except Exception as e:
            print(f"⚠️  実験提案エラー: {e}", file=sys.stderr)
            return {'experiments': []}
    
    def _load_completed_experiments(self):
        """完了した実験を読み込み"""
        experiments = []
        
        for file in sorted(self.data_dir.glob('EXP-*.json'), reverse=True)[:20]:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data.get('status') == 'completed':
                    experiments.append({
                        'experiment_id': data['experiment_id'],
                        'hypothesis': data['hypothesis'],
                        'test_type': data['test_type'],
                        'results': data.get('results', {})
                    })
        
        return experiments
    
    def _save_experiment(self, experiment_data):
        """実験データを保存"""
        file_path = self.data_dir / f"{experiment_data['experiment_id']}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(experiment_data, f, ensure_ascii=False, indent=2)
    
    def _load_experiment(self, experiment_id):
        """実験データを読み込み"""
        file_path = self.data_dir / f"{experiment_id}.json"
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _parse_json_response(self, response_text):
        """JSONレスポンスをパース"""
        try:
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                json_str = response_text.split('```')[1].split('```')[0].strip()
            else:
                json_str = response_text.strip()
            
            return json.loads(json_str)
        except Exception as e:
            print(f"⚠️  JSONパースエラー: {e}", file=sys.stderr)
            return {}

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使い方: python experiment-planner.py <action> [args...]")
        print("action: create, add_post, evaluate, list, suggest")
        sys.exit(1)
    
    action = sys.argv[1]
    
    try:
        planner = ExperimentPlanner()
        
        if action == 'create':
            # 実験を作成
            hypothesis = sys.argv[2] if len(sys.argv) > 2 else "デフォルトの仮説"
            test_type = sys.argv[3] if len(sys.argv) > 3 else "caption"
            result = planner.create_experiment(hypothesis, test_type)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'add_post':
            # 投稿を追加
            experiment_id = sys.argv[2]
            post_id = sys.argv[3]
            condition = sys.argv[4] if len(sys.argv) > 4 else 'test'
            result = planner.add_test_post(experiment_id, post_id, condition)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'evaluate':
            # 実験を評価
            experiment_id = sys.argv[2]
            data_file = sys.argv[3]
            with open(data_file, 'r', encoding='utf-8') as f:
                engagement_data = json.load(f)
            result = planner.evaluate_experiment(experiment_id, engagement_data)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'list':
            # 実行中の実験をリスト
            result = planner.get_active_experiments()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        elif action == 'suggest':
            # 次の実験を提案
            result = planner.suggest_next_experiment()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        else:
            print(f"不明なアクション: {action}")
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
