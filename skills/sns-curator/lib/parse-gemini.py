#!/usr/bin/env python3
"""Gemini APIレスポンスをパース（制御文字エラー対策済み）"""
import sys, json, re

raw = sys.stdin.read()
try:
    data = json.loads(raw)

    # エラーチェック
    if 'error' in data:
        err = data['error']
        print(f"API Error {err.get('code')}: {err.get('message', '')[:200]}", file=sys.stderr)
        sys.exit(1)

    # candidates確認
    candidates = data.get('candidates', [])
    if not candidates:
        print("No candidates in response", file=sys.stderr)
        sys.exit(1)

    finish_reason = candidates[0].get('finishReason', '')
    if finish_reason not in ('STOP', ''):
        print(f"Unexpected finishReason: {finish_reason}", file=sys.stderr)

    text = candidates[0]['content']['parts'][0]['text']
    
    # 制御文字を除去（JSONの中の不正な改行・タブ等）
    # JSON文字列値内の制御文字を安全にエスケープ
    def sanitize_json_string(s):
        """JSON文字列内の制御文字を安全に処理"""
        # まずそのままパースを試みる
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            pass
        
        # 制御文字を置換してリトライ
        sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
        try:
            return json.loads(sanitized)
        except json.JSONDecodeError:
            pass
        
        # JSONブロックを抽出してリトライ
        json_match = re.search(r'\{[\s\S]*\}', sanitized)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        
        raise ValueError("JSON parse failed after sanitization")
    
    parsed = sanitize_json_string(text)
    print(json.dumps(parsed, ensure_ascii=False))

except (json.JSONDecodeError, ValueError) as e:
    print(f"JSON decode error: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Parse error: {e}", file=sys.stderr)
    sys.exit(1)
