#!/bin/bash
set -e

mkdir -p /root/.clawdbot
mkdir -p /root/.clawdbot/agents/main/agent

# Build channels config
DISCORD_CONFIG=""
DISCORD_PLUGIN=""
if [ -n "$DISCORD_BOT_TOKEN" ]; then
  DISCORD_CONFIG='"discord": {
      "enabled": true,
      "token": "'"$DISCORD_BOT_TOKEN"'",
      "dm": {
        "enabled": true,
        "policy": "open",
        "allowFrom": ["*"]
      },
      "groupPolicy": "open",
      "guilds": {
        "*": {
          "requireMention": false
        }
      }
    }'
  DISCORD_PLUGIN='"discord": { "enabled": true }'
  echo "[entrypoint] Discord channel enabled (mention not required)"
fi

# Build auth profiles config
AUTH_PROFILES=""
AUTH_PROFILES_FILE="/root/.clawdbot/agents/main/agent/auth-profiles.json"

if [ -n "$ANTHROPIC_OAUTH_REFRESH_TOKEN" ]; then
  # OAuth mode: use subscription OAuth tokens
  AUTH_PROFILES='"anthropic:claude-cli": { "provider": "anthropic", "mode": "oauth" }'

  # Preserve existing OAuth credentials if they were refreshed by the app (persistent storage)
  SHOULD_WRITE_OAUTH=true
  if [ -f "$AUTH_PROFILES_FILE" ]; then
    if grep -q '"type".*:.*"oauth"' "$AUTH_PROFILES_FILE" 2>/dev/null && \
       grep -q '"refresh"' "$AUTH_PROFILES_FILE" 2>/dev/null; then
      echo "[entrypoint] Existing OAuth credentials found, preserving refreshed tokens"
      SHOULD_WRITE_OAUTH=false
    fi
  fi

  if [ "$SHOULD_WRITE_OAUTH" = true ]; then
    OAUTH_ACCESS="${ANTHROPIC_OAUTH_ACCESS_TOKEN:-}"
    OAUTH_EXPIRES="${ANTHROPIC_OAUTH_EXPIRES:-0}"
    cat > "$AUTH_PROFILES_FILE" << EOF
{
  "version": 1,
  "profiles": {
    "anthropic:claude-cli": {
      "type": "oauth",
      "provider": "anthropic",
      "access": "$OAUTH_ACCESS",
      "refresh": "$ANTHROPIC_OAUTH_REFRESH_TOKEN",
      "expires": $OAUTH_EXPIRES
    }
  }
}
EOF
    echo "[entrypoint] Created auth-profiles.json with OAuth credentials"
  fi

elif [ -n "$ANTHROPIC_API_KEY" ]; then
  AUTH_PROFILES='"anthropic:default": { "provider": "anthropic", "mode": "api_key" }'
  echo "[entrypoint] Anthropic API key configured"

  # Create agent auth profiles file
  cat > "$AUTH_PROFILES_FILE" << EOF
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "token",
      "provider": "anthropic",
      "token": "$ANTHROPIC_API_KEY"
    }
  }
}
EOF
  echo "[entrypoint] Created auth-profiles.json for agent"
fi

# Default model (use Sonnet 4.5 instead of Opus to reduce costs)
DEFAULT_MODEL="${CLAWDBOT_DEFAULT_MODEL:-anthropic/claude-sonnet-4-5}"

# Create config file based on environment variables
if [ "$CLAWDBOT_NO_AUTH" = "true" ] || [ "$CLAWDBOT_NO_AUTH" = "1" ]; then
  # No authentication mode (omit auth.mode to disable auth)
  cat > /root/.clawdbot/clawdbot.json << EOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "$DEFAULT_MODEL"
      }
    }
  },
  "gateway": {
    "controlUi": {
      "enabled": true
    }
  },
  "auth": {
    "profiles": {
      $AUTH_PROFILES
    }
  },
  "channels": {
    $DISCORD_CONFIG
  },
  "plugins": {
    "entries": {
      $DISCORD_PLUGIN
    }
  }
}
EOF
  echo "[entrypoint] Created gateway config with NO auth (public access)"
elif [ -n "$CLAWDBOT_GATEWAY_TOKEN" ]; then
  # Token authentication mode
  cat > /root/.clawdbot/clawdbot.json << EOF
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "$DEFAULT_MODEL"
      }
    }
  },
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "$CLAWDBOT_GATEWAY_TOKEN"
    },
    "controlUi": {
      "enabled": true
    }
  },
  "auth": {
    "profiles": {
      $AUTH_PROFILES
    }
  },
  "channels": {
    $DISCORD_CONFIG
  },
  "plugins": {
    "entries": {
      $DISCORD_PLUGIN
    }
  }
}
EOF
  echo "[entrypoint] Created gateway config with token auth"
else
  echo "[entrypoint] No auth config set. Set CLAWDBOT_GATEWAY_TOKEN or CLAWDBOT_NO_AUTH=true"
fi

# Run startup script if it exists (auto-restore from backup)
if [ -f /app/scripts/startup.sh ]; then
  echo "[entrypoint] Running startup script for auto-restore..."
  bash /app/scripts/startup.sh || true
fi

exec node --max-old-space-size=1024 dist/index.js gateway --bind lan --port 8080 --allow-unconfigured "$@"
