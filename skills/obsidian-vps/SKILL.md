---
name: obsidian-vps
description: Obsidian-like Markdown vault management for VPS (no Homebrew required)
---

# obsidian-vps

VPS環境でObsidian風のMarkdown管理を行うSkill（Homebrew不要）

## Usage

### Daily note（デイリーノート）
```bash
/root/clawd/scripts/obsidian-helper.sh daily
```

### Create note（ノート作成）
```bash
/root/clawd/scripts/obsidian-helper.sh create "projects/my-project"
/root/clawd/scripts/obsidian-helper.sh create "references/article-summary"
```

### Search（検索）
```bash
/root/clawd/scripts/obsidian-helper.sh search "キーワード"
```

### List all notes（一覧）
```bash
/root/clawd/scripts/obsidian-helper.sh list
```

### Edit note（編集）
```bash
/root/clawd/scripts/obsidian-helper.sh edit "projects/my-project"
```

## Vault Location
- Default: `/root/obsidian-vault`
- Override: `export OBSIDIAN_VAULT=/path/to/vault`

## Directory Structure
```
obsidian-vault/
├── daily/           # Daily notes
├── projects/        # Project notes
├── references/      # Reference materials
└── README.md        # Vault overview
```

## Features
- ✅ Daily notes with templates
- ✅ Hierarchical organization
- ✅ Full-text search
- ✅ Markdown-based (portable)
- ✅ No Homebrew required
- ✅ VPS-friendly

## Notes
- Compatible with Obsidian desktop/mobile (sync via git/rsync)
- Pure Markdown - works with any editor
- Lightweight and fast
