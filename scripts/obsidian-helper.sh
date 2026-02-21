#!/bin/bash
# Obsidian-like CLI helper for VPS
VAULT_DIR="${OBSIDIAN_VAULT:-/root/obsidian-vault}"

case "$1" in
  create)
    NOTE_PATH="$VAULT_DIR/$2.md"
    mkdir -p "$(dirname "$NOTE_PATH")"
    echo "# $2" > "$NOTE_PATH"
    echo "Created: $NOTE_PATH"
    ;;
  
  search)
    grep -r "$2" "$VAULT_DIR" --include="*.md"
    ;;
  
  list)
    find "$VAULT_DIR" -name "*.md" -type f
    ;;
  
  daily)
    DATE=$(date +%Y-%m-%d)
    DAILY_PATH="$VAULT_DIR/daily/$DATE.md"
    mkdir -p "$VAULT_DIR/daily"
    if [ ! -f "$DAILY_PATH" ]; then
      cat > "$DAILY_PATH" << EOF
# $DATE

## Notes

## Tasks
- [ ] 

## Links
EOF
    fi
    echo "$DAILY_PATH"
    ;;
  
  edit)
    NOTE_PATH="$VAULT_DIR/$2.md"
    if [ -f "$NOTE_PATH" ]; then
      ${EDITOR:-nano} "$NOTE_PATH"
    else
      echo "Note not found: $NOTE_PATH"
      exit 1
    fi
    ;;
  
  *)
    cat << 'HELP'
Obsidian-like CLI Helper

Usage:
  obsidian-helper create <name>     - Create a new note
  obsidian-helper search <query>    - Search notes
  obsidian-helper list              - List all notes
  obsidian-helper daily             - Create/show today's daily note
  obsidian-helper edit <name>       - Edit a note

Environment:
  OBSIDIAN_VAULT - Vault directory (default: /root/obsidian-vault)
HELP
    ;;
esac
