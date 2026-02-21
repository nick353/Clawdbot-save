#!/usr/bin/env python3
"""生成投稿をX/LinkedInに投稿"""
import sys, json, subprocess, os, time

output_file = sys.argv[1]
script_dir = sys.argv[2]
x_only = sys.argv[3] == 'true'
li_only = sys.argv[4] == 'true'
eyecatch_paths_file = sys.argv[5]

try:
    d = json.load(open(output_file))
    posts = d.get('generated_posts', [])
except Exception as e:
    print(f'❌ 投稿データ読み込みエラー: {e}', file=sys.stderr)
    sys.exit(0)

try:
    eyecatch_paths = json.load(open(eyecatch_paths_file))
except Exception:
    eyecatch_paths = []

for i, post in enumerate(posts):
    print(f'\n--- 投稿 {i+1}/{len(posts)} ---')
    x_text = post.get('x_post', '')
    li_text = post.get('linkedin_post', '')
    image_path = eyecatch_paths[i] if i < len(eyecatch_paths) else None

    # X投稿
    if not li_only and x_text:
        print(f'📤 X投稿: {x_text[:60]}...')
        cmd = ['node', f'{script_dir}/post-to-x-personal.cjs', x_text]
        if image_path and os.path.exists(image_path):
            cmd.append(image_path)
            print(f'📷 画像添付: {image_path}')
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                print('✅ X投稿: 完了')
            else:
                print('⚠️  X投稿: スキップまたはエラー')
            if result.stdout:
                print(result.stdout[-500:])
        except Exception as e:
            print(f'⚠️  X投稿例外: {e}')

    # LinkedIn投稿
    if not x_only and li_text:
        print(f'📤 LinkedIn投稿: {li_text[:60]}...')
        cmd = ['node', f'{script_dir}/post-to-linkedin.cjs', li_text]
        if image_path and os.path.exists(image_path):
            cmd.append(image_path)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                print('✅ LinkedIn投稿: 完了')
            else:
                print('⚠️  LinkedIn投稿: スキップまたはエラー')
            if result.stdout:
                print(result.stdout[-300:])
        except Exception as e:
            print(f'⚠️  LinkedIn投稿例外: {e}')

    time.sleep(10)
