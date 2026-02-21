#!/bin/bash
# DeepFilterNet3 セットアップスクリプト
# 作成: リッキー 🐥
# 日付: 2026-02-16

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎙️ DeepFilterNet3 セットアップ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

INSTALL_DIR="/root/clawd/envs/deepfilternet"

# ========================================
# 1. Rustインストール確認
# ========================================
echo "🦀 [1/5] Rustインストール確認..."

if ! command -v rustc &> /dev/null; then
    echo "  Rustが見つかりません。インストール中..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
    echo "  ✅ Rustインストール完了"
else
    echo "  ✅ Rust既にインストール済み（$(rustc --version)）"
fi

echo ""

# ========================================
# 2. Python仮想環境作成
# ========================================
echo "🐍 [2/5] Python仮想環境作成..."

if [ -d "$INSTALL_DIR" ]; then
    echo "  ⚠️ 既存の環境が見つかりました。削除して再作成しますか？"
    read -p "  続行しますか？ (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "  セットアップを中止しました"
        exit 0
    fi
fi

python3 -m venv "$INSTALL_DIR"
source "$INSTALL_DIR/bin/activate"

echo "  ✅ Python仮想環境作成完了"
echo ""

# ========================================
# 3. PyTorchインストール
# ========================================
echo "🔥 [3/5] PyTorch インストール（CPU版）..."

pip install --upgrade pip -q
pip install torch==2.2.0+cpu torchaudio==2.2.0+cpu --index-url https://download.pytorch.org/whl/cpu -q

echo "  ✅ PyTorchインストール完了"
echo ""

# ========================================
# 4. soundfileインストール
# ========================================
echo "🎵 [4/5] soundfile インストール..."

pip install soundfile -q

echo "  ✅ soundfileインストール完了"
echo ""

# ========================================
# 5. DeepFilterNetインストール
# ========================================
echo "🎙️ [5/5] DeepFilterNet インストール..."

source $HOME/.cargo/env
pip install deepfilternet -q

echo "  ✅ DeepFilterNetインストール完了"
echo ""

# ========================================
# インストール確認
# ========================================
# ========================================
# 6. shebangのパスを修正（重要）
# ========================================
echo "🔧 [6/6] shebangパスを修正..."

DEEPFILTER_CMD="$INSTALL_DIR/bin/deepFilter"
PYTHON_PATH="$INSTALL_DIR/bin/python3"

# shebangを正しいPythonパスに修正
sed -i "1s|.*|#!$PYTHON_PATH|" "$DEEPFILTER_CMD"
echo "  ✅ shebang修正完了: $PYTHON_PATH"
echo ""

# ========================================
# セットアップ確認
# ========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ セットアップ完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 インストールされたパッケージ:"
pip list | grep -E "torch|deepfilter|soundfile"
echo ""
echo "📁 インストール先: $INSTALL_DIR"
echo ""
echo "🧪 テスト実行:"
echo "  $PYTHON_PATH $DEEPFILTER_CMD --help"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deactivate
