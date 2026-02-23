#!/bin/bash
# FxEmbed Twitter Link Converter
# Converts twitter.com and x.com URLs to fxtwitter.com for Discord embeds
# Usage: convert-twitter-links.sh "text with https://x.com/user/status/123 link"

if [ -z "$1" ]; then
    echo "Error: No text provided"
    exit 1
fi

TEXT="$1"

# Replace x.com with fxtwitter.com
TEXT="${TEXT//https:\/\/x.com\//https://fxtwitter.com/}"
TEXT="${TEXT//http:\/\/x.com\//http://fxtwitter.com/}"

# Replace twitter.com with fxtwitter.com
TEXT="${TEXT//https:\/\/twitter.com\//https://fxtwitter.com/}"
TEXT="${TEXT//http:\/\/twitter.com\//http://fxtwitter.com/}"

echo "$TEXT"
